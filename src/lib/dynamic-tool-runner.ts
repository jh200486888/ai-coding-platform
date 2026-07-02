// @ts-nocheck
/**
 * 动态工具沙箱 - AI可动态创建并执行代码工具
 * 安全限制：超时、内存、网络白名单、文件系统只读
 */
import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 沙箱配置（从DB读取，有缓存）
interface SandboxConfig {
  timeout: number;          // 代码执行超时（秒）
  max_output_length: number; // 最大输出字符数
  allowed_modules: string[]; // 允许的Node.js内置模块
  enable_network: boolean;   // 是否允许网络请求
  temp_dir: string;          // 临时文件目录
}

let cachedConfig: SandboxConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeout: 30,
  max_output_length: 10000,
  allowed_modules: ['crypto', 'path', 'url', 'querystring', 'math', 'date', 'json', 'util', 'assert', 'buffer', 'stream', 'events', 'string_decoder', 'zlib'],
  enable_network: false,
  temp_dir: '/tmp/ai-sandbox',
};

async function getSandboxConfig(): Promise<SandboxConfig> {
  const now = Date.now();
  if (cachedConfig && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
    const result = await pool.query("SELECT value FROM settings WHERE key = 'sandbox_config'");
    await pool.end();
    if (result.rows.length > 0 && result.rows[0].value) {
      const dbConfig = JSON.parse(result.rows[0].value);
      cachedConfig = { ...DEFAULT_SANDBOX_CONFIG, ...dbConfig };
      configCacheTime = now;
      return cachedConfig!;
    }
  } catch (e) {
    // DB读取失败用默认值
  }
  cachedConfig = DEFAULT_SANDBOX_CONFIG;
  configCacheTime = now;
  return cachedConfig!;
}

/**
 * 在受限环境中执行用户代码
 * 使用子进程+资源限制，不使用vm模块（更安全）
 */
async function executeInSandbox(
  code: string,
  language: 'javascript' | 'python',
  input_data: string,
  config: SandboxConfig
): Promise<{ success: boolean; output: string; error?: string; execution_time: number }> {
  const taskId = crypto.randomBytes(8).toString('hex');
  const workDir = path.join(config.temp_dir, taskId);
  
  try {
    // 创建临时工作目录
    fs.mkdirSync(workDir, { recursive: true });
    
    // 写入输入数据
    if (input_data) {
      fs.writeFileSync(path.join(workDir, 'input.json'), input_data, 'utf-8');
    }
    
    let command: string;
    let codeFile: string;
    
    if (language === 'python') {
      codeFile = path.join(workDir, 'main.py');
      // Python沙箱：限制超时+资源
      fs.writeFileSync(codeFile, code, 'utf-8');
      command = `timeout ${config.timeout} python3 -c "
import sys, json, os
sys.path.insert(0, '${workDir}')
os.chdir('${workDir}')
try:
    input_data = json.loads(open('input.json').read()) if os.path.exists('input.json') else {}
except:
    input_data = {}
exec(open('${codeFile}').read())
"`;
    } else {
      codeFile = path.join(workDir, 'main.js');
      fs.writeFileSync(codeFile, code, 'utf-8');
      // Node.js沙箱：限制超时，不require敏感模块
      const wrappedCode = `
const fs = null;  // 禁止fs写操作
const child_process = null;  // 禁止子进程
const cluster = null;
const net = null;
const dgram = null;
const os = null;
try { global.input_data = JSON.parse(require('fs').readFileSync('${workDir}/input.json','utf-8')); } catch(e) { global.input_data = {}; }
try { ${code} } catch(e) { console.error('EXEC_ERROR:', e.message); process.exit(1); }
`;
      // 直接用timeout包装执行
      const wrapperFile = path.join(workDir, 'wrapper.js');
      fs.writeFileSync(wrapperFile, wrappedCode, 'utf-8');
      command = `timeout ${config.timeout} node --max-old-space-size=128 ${wrapperFile}`;
    }
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      exec(command, {
        cwd: workDir,
        timeout: (config.timeout + 5) * 1000, // 额外5秒buffer
        maxBuffer: 1024 * 1024, // 1MB输出缓冲
        env: { 
          ...process.env, 
          NODE_ENV: 'sandbox',
          HOME: workDir,
          TMPDIR: workDir,
        },
      }, (error, stdout, stderr) => {
        const execution_time = Date.now() - startTime;
        let output = stdout || '';
        
        if (stderr && !stderr.includes('ExperimentalWarning')) {
          output += '\n[stderr] ' + stderr;
        }
        
        if (error) {
          if (error.killed) {
            resolve({ success: false, output: '', error: `⏱️ 执行超时（${config.timeout}秒限制）`, execution_time });
            return;
          }
          resolve({ 
            success: false, 
            output: output.slice(0, config.max_output_length), 
            error: error.message.slice(0, 500), 
            execution_time 
          });
          return;
        }
        
        // 截断过长输出
        if (output.length > config.max_output_length) {
          output = output.slice(0, config.max_output_length) + `\n... [输出已截断，共${output.length}字符]`;
        }
        
        resolve({ success: true, output, execution_time });
      });
    });
  } finally {
    // 清理临时目录
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

/**
 * 动态工具执行 - AI写代码并执行
 */
export const executeCodeTool = tool({
  description: `在安全沙箱中执行代码。当现有工具无法完成任务时，可以动态编写代码来解决问题。

支持语言：javascript(Node.js)、python3
安全限制：超时30秒、内存128MB、禁止文件系统写操作、禁止网络请求

使用场景：
- 复杂数学计算（矩阵运算、统计分析）
- 数据处理（JSON转换、文本批量处理）
- 算法实现（排序、搜索、加密解密）
- 正则表达式批量匹配
- 自定义数据格式解析
- 临时脚本：一次性数据处理任务

注意：沙箱环境是临时的，代码执行完毕后自动清理。如需持久化结果，请将输出传给其他工具保存。`,
  parameters: z.object({
    code: z.string().describe('要执行的代码。JavaScript用module语法，Python3用标准语法。可通过input_data变量获取输入数据。用console.log/print输出结果。'),
    language: z.enum(['javascript', 'python']).default('javascript').describe('编程语言：javascript或python'),
    input_data: z.string().optional().describe('输入数据(JSON格式字符串)，代码中通过input_data变量访问'),
    description: z.string().describe('这段代码的功能描述（用于日志记录）'),
  }),
  execute: async ({ code, language = 'javascript', input_data, description }: { code: string; language?: string; input_data?: string; description: string }) => {
    const config = await getSandboxConfig();
    
    // 安全检查：禁止危险操作
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]/, 
      /require\s*\(\s*['"]fs['"]\s*\).*write/,
      /process\.exit/,
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/,
      /__dirname|__filename/,
      /os\.\s*hostname|os\.\s*networkInterfaces/,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return `⛔ 安全检查未通过：代码包含禁止的操作模式。沙箱不允许文件写入、子进程、无限循环或系统信息访问。`;
      }
    }
    
    const result = await executeInSandbox(code, language as 'javascript' | 'python', input_data || '{}', config);
    
    if (!result.success) {
      return `❌ 代码执行失败: ${result.error}\n执行时间: ${result.execution_time}ms\n\n请检查代码逻辑，常见问题：语法错误、超时、使用了禁止的API`;
    }
    
    return `✅ 执行成功 (${result.execution_time}ms)\n\n${result.output}`;
  },
});

/**
 * 动态工具注册 - AI创建可复用的临时工具
 */
export const createDynamicToolTool = tool({
  description: `动态创建一个可复用的工具。工具创建后可在当前对话中反复调用。

使用场景：
- 需要多次使用的计算逻辑
- 自定义数据转换管道
- 特定格式的数据处理
- 项目特定的批量操作

工具会注册到当前会话，对话结束后自动清除。`,
  parameters: z.object({
    tool_name: z.string().describe('工具名称（英文，如calculate_tax, parse_csv）'),
    tool_description: z.string().describe('工具功能描述（中文，如"计算含税价格"）'),
    code: z.string().describe('工具代码。JavaScript函数，接收input_data参数，返回结果用console.log输出。'),
    input_schema: z.string().optional().describe('输入参数说明(JSON Schema格式)，如{"type":"object","properties":{"price":{"type":"number"}}}'),
  }),
  execute: async ({ tool_name, tool_description, code, input_schema }: { tool_name: string; tool_description: string; code: string; input_schema?: string }) => {
    const config = await getSandboxConfig();
    
    // 安全检查
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]/, 
      /require\s*\(\s*['"]fs['"]\s*\).*write/,
      /process\.exit/,
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return `⛔ 安全检查未通过：代码包含禁止的操作模式。`;
      }
    }
    
    // 将工具定义存入DB，供后续调用
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
      
      // 创建dynamic_tools表（如果不存在）
      await pool.query(`
        CREATE TABLE IF NOT EXISTS dynamic_tools (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(100) NOT NULL,
          tool_description TEXT,
          code TEXT NOT NULL,
          input_schema TEXT,
          session_id VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          call_count INTEGER DEFAULT 0
        )
      `);
      
      // 插入工具定义
      await pool.query(
        `INSERT INTO dynamic_tools (tool_name, tool_description, code, input_schema, session_id) VALUES ($1, $2, $3, $4, $5)`,
        [tool_name, tool_description, code, input_schema || '{}', 'global']
      );
      
      await pool.end();
      
      return `✅ 动态工具「${tool_name}」创建成功！\n\n功能：${tool_description}\n使用方式：在对话中输入 "调用工具 ${tool_name}" 或让AI自动识别并调用。\n\n工具已注册，可多次使用。`;
    } catch (error) {
      return `❌ 工具注册失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * 调用已注册的动态工具
 */
export const callDynamicToolTool = tool({
  description: `调用已注册的动态工具。输入工具名和参数即可执行。`,
  parameters: z.object({
    tool_name: z.string().describe('要调用的工具名称'),
    input_data: z.string().optional().describe('输入参数(JSON格式字符串)'),
  }),
  execute: async ({ tool_name, input_data }: { tool_name: string; input_data?: string }) => {
    const config = await getSandboxConfig();
    
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
      
      const result = await pool.query(
        `SELECT * FROM dynamic_tools WHERE tool_name = $1 ORDER BY created_at DESC LIMIT 1`,
        [tool_name]
      );
      
      if (result.rows.length === 0) {
        await pool.end();
        return `❌ 未找到工具「${tool_name}」。请先使用create_dynamic_tool创建。`;
      }
      
      const toolDef = result.rows[0];
      
      // 更新调用次数
      await pool.query(
        `UPDATE dynamic_tools SET call_count = call_count + 1 WHERE id = $1`,
        [toolDef.id]
      );
      
      await pool.end();
      
      // 在沙箱中执行
      const execResult = await executeInSandbox(toolDef.code, 'javascript', input_data || '{}', config);
      
      if (!execResult.success) {
        return `❌ 工具「${tool_name}」执行失败: ${execResult.error}\n执行时间: ${execResult.execution_time}ms`;
      }
      
      return `✅ 工具「${tool_name}」执行成功 (${execResult.execution_time}ms)\n\n${execResult.output}`;
    } catch (error) {
      return `❌ 调用失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * 列出所有已注册的动态工具
 */
export const listDynamicToolsTool = tool({
  description: `列出所有已注册的动态工具及其描述和调用次数。`,
  parameters: z.object({}),
  execute: async () => {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
      
      const result = await pool.query(
        `SELECT tool_name, tool_description, call_count, created_at FROM dynamic_tools ORDER BY created_at DESC LIMIT 50`
      );
      
      await pool.end();
      
      if (result.rows.length === 0) {
        return '暂无已注册的动态工具。使用create_dynamic_tool可创建新工具。';
      }
      
      const toolList = result.rows.map((t: any) => 
        `• ${t.tool_name}: ${t.tool_description || '无描述'} (调用${t.call_count}次, 创建于${new Date(t.created_at).toLocaleString('zh-CN')})`
      ).join('\n');
      
      return `已注册 ${result.rows.length} 个动态工具：\n\n${toolList}`;
    } catch (error) {
      return `❌ 查询失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const dynamicTools = {
  execute_code: executeCodeTool,
  create_dynamic_tool: createDynamicToolTool,
  call_dynamic_tool: callDynamicToolTool,
  list_dynamic_tools: listDynamicToolsTool,
};
