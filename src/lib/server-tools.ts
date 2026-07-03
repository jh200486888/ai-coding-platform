// @ts-nocheck // AI SDK v7 tool() type inference issue with toolApproval, remove when SDK fixes
/**
 * 服务器操作工具 - AI SDK tool() 定义
 * Phase 3: 内置自我验证闭环 - 每个操作自动验证结果
 */
import { tool } from 'ai';
import { z } from 'zod';
import { sshPool, DANGEROUS_COMMANDS } from './ssh-pool';

// ==================== SSH 执行命令 ====================
export const sshExecuteTool = tool({
  description: `在远程服务器上执行shell命令。支持production(85服务器)和development(182服务器)。

安全规则：
- 危险命令(rm -rf /, DROP DATABASE, shutdown等)会被自动拦截
- 写入操作(rm, DELETE, pm2 restart等)需要用户审批确认
- 默认超时60秒，构建等长任务可设300秒

使用场景：查看文件、运行命令、检查进程、Git操作等`,
  parameters: z.object({
    command: z.string().optional().default('').describe('要执行的shell命令。必填，不能为空'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器: production=85服务器, development=182服务器'),
    timeout: z.number().default(60).describe('超时秒数，默认60。构建等长任务设300'),
    cwd: z.string().optional().describe('工作目录，默认为项目根目录'),
  }),
  execute: async ({ command, server = 'production', timeout, cwd }: { command: string; server?: string; timeout: number; cwd?: string }) => {
    // P81: Empty/missing command guard - return friendly error so model retries
    if (!command || command.trim() === '' || command === 'undefined') {
      return '❌ 参数错误: command为空。请重新调用ssh_execute并传入具体的shell命令字符串，例如: {"command": "ls -la"}';
    }
    // Defensive: ensure server is valid
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    for (const pattern of DANGEROUS_COMMANDS) {
      if (pattern.test(command)) {
        return '⛔ 危险命令被拦截: "' + command + '" 匹配安全黑名单规则。此操作可能导致数据丢失或系统不可用。';
      }
    }
    try {
      const result = await sshPool.execute(effectiveServer, command, {
        timeout: timeout * 1000,
        cwd,
      });

      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr && result.code !== 0) output += `\n[stderr] ${result.stderr}`;
      if (result.code !== 0) output += `\n[退出码: ${result.code}]`;

      if (output.length > 8000) {
        output = output.slice(0, 8000) + '\n... [输出已截断，共' + output.length + '字符]';
      }

      return output || '(无输出)';
    } catch (error) {
      return `❌ 执行失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== SSH 读取文件 ====================
export const sshReadFileTool = tool({
  description: `读取远程服务器上的文件内容。自动处理大文件截断。

使用场景：查看配置文件、读取源代码、检查日志等`,
  parameters: z.object({
    path: z.string().optional().default('').describe('服务器上的文件绝对路径'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    startLine: z.number().optional().describe('起始行号(从0开始)，大文件分段读取'),
    endLine: z.number().optional().describe('结束行号，默认读全部'),
  }),
  execute: async ({ path, server = 'production', startLine, endLine }: { path: string; server?: string; startLine?: number; endLine?: number }) => {
    // P81: Empty path guard
    if (!path || path.trim() === '' || path === 'undefined') {
      return '❌ 参数错误: path为空。请重新调用ssh_read_file并传入具体的文件路径，例如: {"path": "/etc/hostname"}';
    }
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    try {
      let content = await sshPool.readFile(effectiveServer, path);

      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine || 0;
        const end = endLine || lines.length;
        content = lines.slice(start, end)
          .map((line, i) => `${start + i + 1}\t${line}`)
          .join('\n');
      }

      if (content.length > 10000) {
        content = content.slice(0, 10000) + '\n... [文件过长，已截断]';
      }

      return content || '(空文件)';
    } catch (error) {
      return `❌ 读取失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== SSH 写入文件（+写入验证） ====================
export const sshWriteFileTool = tool({
  description: `在远程服务器上写入或修改文件。⚠️ 此操作需要用户审批确认。

安全特性：
- 写入前自动备份原文件(添加.bak.时间戳后缀)
- 使用base64编码传输，避免SSH转义问题
- 写入后自动验证：检查文件存在+行数一致

使用场景：修改源代码、更新配置文件等`,
  parameters: z.object({
    path: z.string().optional().default('').describe('服务器上的文件绝对路径'),
    content: z.string().describe('要写入的完整文件内容'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    backup: z.boolean().default(true).describe('是否备份原文件，默认true'),
  }),
  execute: async ({ path, content, server = 'production', backup }: { path: string; content: string; server?: string; backup?: boolean }) => {
    // P81: Empty parameter guard
    if (!path || path.trim() === '' || path === 'undefined') {
      return '❌ 参数错误: path为空。请重新调用ssh_write_file并传入具体的文件路径';
    }
    if (!content || content === 'undefined') {
      return '❌ 参数错误: content为空。请重新调用并传入要写入的文件内容';
    }
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    try {
      const result = await sshPool.writeFile(effectiveServer, path, content, backup);
      let msg = `✅ 文件已写入: ${path}`;
      if (result.backupPath) {
        msg += `\n📦 备份: ${result.backupPath}`;
      }

      // 写入验证：检查文件存在 + 行数
      const expectedLines = content.split('\n').length;
      const verifyResult = await sshPool.execute(effectiveServer, `wc -l < "${path}" 2>/dev/null && echo "EXISTS" || echo "MISSING"`);
      const actualLines = parseInt(verifyResult.stdout.split('\n')[0]) || 0;
      const fileExists = verifyResult.stdout.includes('EXISTS');

      if (!fileExists) {
        msg += `\n⚠️ 验证警告: 写入后文件不存在，可能路径错误`;
      } else if (Math.abs(actualLines - expectedLines) > 2) {
        msg += `\n⚠️ 验证警告: 预期${expectedLines}行，实际${actualLines}行，差异较大`;
      } else {
        msg += `\n✅ 验证通过: ${actualLines}行`;
      }

      return msg;
    } catch (error) {
      return `❌ 写入失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 构建项目（+错误定位） ====================
export const buildProjectTool = tool({
  description: `在远程服务器上构建Next.js项目。自动设置内存限制(3GB)防止OOM。

流程：pnpm build → 检查构建结果
- 成功：返回构建信息
- 失败：自动提取错误类型、文件路径、行号，便于AI分析修复
此操作需要用户审批确认(因为耗时较长且影响服务)。`,
  parameters: z.object({
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
  }),
  execute: async ({ server }: { server?: string }) => {
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    try {
      const result = await sshPool.execute(effectiveServer,
        'NODE_OPTIONS="--max-old-space-size=3072" pnpm build 2>&1 | tail -80',
        { timeout: 300000 }
      );

      const output = result.stdout + (result.stderr ? `\n${result.stderr}` : '');
      if (output.includes('✓ Compiled successfully') || output.includes('Build completed') || result.code === 0) {
        return `✅ 构建成功\n${output.slice(-2000)}`;
      } else {
        // 构建失败 - 提取关键错误信息
        let errorSummary = `❌ 构建失败\n${output.slice(-3000)}`;

        // 自动提取错误类型
        const typeError = output.match(/Type error: (.+)/);
        const syntaxError = output.match(/SyntaxError: (.+)/);
        const moduleNotFound = output.match(/Module not found: (.+)/);
        const errorFile = output.match(/\.\/src\/[^\s:]+/);

        if (typeError) errorSummary += `\n\n🔍 错误类型: TypeScript类型错误\n📝 ${typeError[1]}`;
        if (syntaxError) errorSummary += `\n\n🔍 错误类型: 语法错误\n📝 ${syntaxError[1]}`;
        if (moduleNotFound) errorSummary += `\n\n🔍 错误类型: 模块未找到\n📝 ${moduleNotFound[1]}`;
        if (errorFile) errorSummary += `\n\n📁 涉及文件: ${errorFile[0]}`;

        errorSummary += '\n\n💡 建议: 使用ssh_read_file查看出错文件，修复后重新build_project';

        return errorSummary;
      }
    } catch (error) {
      return `❌ 构建异常: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 部署服务（+失败自动诊断） ====================
export const deployServiceTool = tool({
  description: `部署服务：PM2重启 + HTTP健康检查。⚠️ 需要用户审批。

流程：pm2 restart → 等待5秒 → curl验证HTTP 200
- 成功：返回部署信息
- 失败：自动获取PM2日志和最近错误，辅助AI诊断问题`,
  parameters: z.object({
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
  }),
  execute: async ({ server }: { server?: string }) => {
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    try {
      const pm2Service = effectiveServer === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
      const appPort = effectiveServer === 'production' ? 5000 : 5001;
      const projectDir = effectiveServer === 'production' ? '/www/wwwroot/agent.piyiguo.com' : '/www/wwwroot/dev.agent.piyiguo.com';

      // 重启PM2
      const restartResult = await sshPool.execute(effectiveServer, `pm2 restart ${pm2Service}`);
      if (restartResult.code !== 0) {
        return `❌ PM2重启失败: ${restartResult.stderr}`;
      }

      // 等待启动
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 健康检查（最多重试3次）
      let httpCode = '';
      for (let i = 0; i < 3; i++) {
        const healthResult = await sshPool.execute(effectiveServer, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${appPort} --max-time 10`);
        httpCode = healthResult.stdout.trim();
        if (httpCode === '200' || httpCode === '302') break;
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 5000));
      }

      if (httpCode === '200' || httpCode === '302') {
        return `✅ 部署成功\n- PM2服务: ${pm2Service} 已重启\n- 健康检查: HTTP ${httpCode}\n- 服务端口: ${appPort}`;
      } else {
        // 部署失败 - 自动诊断
        let diagnostic = `⚠️ 部署完成但健康检查异常\n- PM2服务: ${pm2Service} 已重启\n- 健康检查: HTTP ${httpCode} (预期200)\n`;

        // 获取PM2状态
        const pm2Status = await sshPool.execute(effectiveServer, `pm2 show ${pm2Service} 2>/dev/null | grep -E "status|uptime|restarts" | head -3`);
        diagnostic += `\n📊 PM2状态:\n${pm2Status.stdout.trim()}`;

        // 获取最近错误日志
        const errorLog = await sshPool.execute(effectiveServer, `pm2 logs ${pm2Service} --nostream --lines 20 --err 2>/dev/null`);
        if (errorLog.stdout.trim()) {
          diagnostic += `\n\n🔴 最近错误日志:\n${errorLog.stdout.trim().slice(0, 2000)}`;
        }

        diagnostic += '\n\n💡 建议: 使用diagnose_error工具深度诊断，或检查.env配置和数据库连接';

        return diagnostic;
      }
    } catch (error) {
      return `❌ 部署异常: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 健康检查 ====================
export const healthCheckTool = tool({
  description: `检查远程服务器健康状态。支持多种检查项。

检查项：
- http: HTTP响应状态码
- pm2: PM2进程状态
- disk: 磁盘使用率
- memory: 内存使用率
- db: 数据库连接`,
  parameters: z.object({
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    checks: z.array(z.enum(['http', 'pm2', 'disk', 'memory', 'db'])).default(['http', 'pm2', 'memory']).describe('要检查的项目'),
  }),
  execute: async ({ server, checks }: { server?: string; checks?: Array<'http' | 'pm2' | 'disk' | 'memory' | 'db'> }) => {
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    const effectiveChecks = checks || ['http', 'pm2', 'memory'];
    const results: string[] = [];

    try {
      if (effectiveChecks.includes('http')) {
        const port = effectiveServer === 'production' ? 5000 : 5001;
        const r = await sshPool.execute(effectiveServer, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port} --max-time 5`);
        results.push(`HTTP: ${r.stdout.trim() === '200' || r.stdout.trim() === '302' ? '✅' : '❌'} 状态码 ${r.stdout.trim()}`);
      }

      if (effectiveChecks.includes('pm2')) {
        const pm2Svc = effectiveServer === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
        const r = await sshPool.execute(effectiveServer, `pm2 show ${pm2Svc} 2>/dev/null | grep -E "status|uptime|restarts" | head -3`);
        results.push(`PM2: ${r.stdout.trim() || '❌ 进程未找到'}`);
      }

      if (effectiveChecks.includes('disk')) {
        const r = await sshPool.execute(effectiveServer, 'df -h / | tail -1');
        results.push(`磁盘: ${r.stdout.trim()}`);
      }

      if (effectiveChecks.includes('memory')) {
        const r = await sshPool.execute(effectiveServer, 'free -h | head -2');
        results.push(`内存:\n${r.stdout.trim()}`);
      }

      if (effectiveChecks.includes('db')) {
        const port = server === 'production' ? 5432 : 5433;
        const r = await sshPool.execute(effectiveServer, `PGPASSWORD=i3m8x5a2e8 psql -h 127.0.0.1 -p ${port} -U agent -d agent -c "SELECT 1" 2>&1 | head -3`);
        results.push(`数据库: ${r.stdout.includes('1 row') ? '✅ 连接正常' : '❌ ' + r.stdout.trim()}`);
      }

      return results.join('\n\n');
    } catch (error) {
      return `❌ 健康检查失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== Git 提交 ====================
export const gitCommitTool = tool({
  description: `在远程服务器上执行Git提交。⚠️ 涉及代码变更需用户确认。

流程：git status → git add → git commit → 显示commit hash`,
  parameters: z.object({
    message: z.string().describe('提交信息'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
  }),
  execute: async ({ message, server }: { message: string; server?: string }) => {
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    try {
      const statusResult = await sshPool.execute(effectiveServer, 'git status --short');
      if (!statusResult.stdout.trim()) {
        return 'ℹ️ 没有需要提交的变更';
      }

      const escapedMsg = message.replace(/"/g, '\\"');
      const addResult = await sshPool.execute(effectiveServer, 'git add -A');
      if (addResult.code !== 0) {
        return `❌ git add 失败: ${addResult.stderr}`;
      }

      const commitResult = await sshPool.execute(effectiveServer, `git commit -m "${escapedMsg}"`);
      if (commitResult.code !== 0) {
        return `❌ git commit 失败: ${commitResult.stderr}`;
      }

      const hashResult = await sshPool.execute(effectiveServer, 'git rev-parse --short HEAD');
      return `✅ 提交成功: ${hashResult.stdout.trim()}\n📝 ${message}\n📋 变更文件:\n${statusResult.stdout.trim().slice(0, 1000)}`;
    } catch (error) {
      return `❌ Git操作失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 深度诊断工具（Phase 3 新增） ====================
export const diagnoseErrorTool = tool({
  description: `深度诊断服务器错误。当服务异常、构建失败或部署失败时使用。

自动执行以下检查：
1. PM2进程状态和重启次数
2. PM2最近错误日志(最后30行)
3. .env文件存在性
4. 数据库连接状态
5. 磁盘空间
6. Next.js构建产物完整性
7. 端口占用情况

返回结构化诊断报告，帮助AI分析根因并制定修复方案。`,
  parameters: z.object({
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    focus: z.enum(['build', 'deploy', 'runtime', 'db', 'all']).default('all').describe('诊断焦点'),
  }),
  execute: async ({ server, focus }: { server?: string; focus?: 'build' | 'deploy' | 'runtime' | 'db' | 'all' }) => {
    const effectiveServer = (server === 'production' || server === 'development') ? server : 'production';
    const pm2Service = effectiveServer === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
    const appPort = effectiveServer === 'production' ? 5000 : 5001;
    const projectDir = effectiveServer === 'production' ? '/www/wwwroot/agent.piyiguo.com' : '/www/wwwroot/dev.agent.piyiguo.com';
    const dbPort = effectiveServer === 'production' ? 5432 : 5433;
    const results: string[] = [`🔍 深度诊断报告 [${server}服务器]\n焦点: ${focus}\n`];

    try {
      // 1. PM2状态
      if (focus === 'all' || focus === 'deploy' || focus === 'runtime') {
        const pm2Show = await sshPool.execute(effectiveServer, `pm2 show ${pm2Service} 2>/dev/null | grep -E "status|uptime|restarts|memory|cpu" | head -5`);
        results.push(`📊 PM2状态:\n${pm2Show.stdout.trim() || '❌ 进程不存在'}`);

        const pm2Logs = await sshPool.execute(effectiveServer, `pm2 logs ${pm2Service} --nostream --lines 30 --err 2>/dev/null`);
        if (pm2Logs.stdout.trim()) {
          results.push(`🔴 最近错误日志:\n${pm2Logs.stdout.trim().slice(0, 3000)}`);
        }
      }

      // 2. 构建产物
      if (focus === 'all' || focus === 'build' || focus === 'deploy') {
        const nextDir = await sshPool.execute(effectiveServer, `ls -la ${projectDir}/.next/ 2>/dev/null | head -5`);
        results.push(`📁 构建产物:\n${nextDir.stdout.trim() || '❌ .next目录不存在，需要构建'}`);

        const buildId = await sshPool.execute(effectiveServer, `cat ${projectDir}/.next/BUILD_ID 2>/dev/null`);
        results.push(`🏗️ BUILD_ID: ${buildId.stdout.trim() || '❌ 不存在'}`);
      }

      // 3. 环境配置
      if (focus === 'all' || focus === 'deploy' || focus === 'runtime') {
        const envExists = await sshPool.execute(effectiveServer, `test -f ${projectDir}/.env && echo "EXISTS" || echo "MISSING"`);
        results.push(`⚙️ .env文件: ${envExists.stdout.trim()}`);

        const envKeys = await sshPool.execute(effectiveServer, `grep -c "^[A-Z]" ${projectDir}/.env 2>/dev/null`);
        results.push(`📋 .env配置项数: ${envKeys.stdout.trim() || '0'}`);
      }

      // 4. 数据库
      if (focus === 'all' || focus === 'db' || focus === 'runtime') {
        const dbCheck = await sshPool.execute(effectiveServer, `psql -h 127.0.0.1 -p ${dbPort} -U agent -d agent -c "SELECT count(*) FROM conversations" 2>&1 | head -3`, { timeout: 10000 });
        results.push(`🗄️ 数据库: ${dbCheck.stdout.includes('1 row') || dbCheck.stdout.includes('count') ? '✅ 连接正常' : '❌ ' + dbCheck.stdout.trim()}`);
      }

      // 5. 端口和磁盘
      if (focus === 'all' || focus === 'deploy' || focus === 'runtime') {
        const portCheck = await sshPool.execute(effectiveServer, `ss -tlnp | grep ${appPort} | head -3`);
        results.push(`🔌 端口${appPort}: ${portCheck.stdout.trim() || '❌ 未监听'}`);

        const disk = await sshPool.execute(effectiveServer, 'df -h / | tail -1');
        results.push(`💾 磁盘: ${disk.stdout.trim()}`);

        const mem = await sshPool.execute(effectiveServer, 'free -h | grep Mem');
        results.push(`🧠 内存: ${mem.stdout.trim()}`);
      }

      results.push('\n💡 基于以上诊断结果，请分析根因并制定修复方案。');

      return results.join('\n\n');
    } catch (error) {
      return `❌ 诊断失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 智能联网搜索（Tavily + Bing fallback） ====================
export const smartSearchTool = tool({
  description: `智能联网搜索，获取实时信息。支持多搜索引擎自动切换。

使用场景：
- 查询最新技术动态、API文档用法
- 搜索错误信息的解决方案
- 查询实时数据（价格、新闻、赛事）
- 查找库/框架的最新版本和用法

搜索技巧：关键词2-5个，简洁精准。需要深入了解时先搜索再配合readUrl读取全文。`,
  parameters: z.object({
    query: z.string().optional().default('').describe('搜索关键词，2-5个词最佳'),
    search_depth: z.enum(['basic', 'advanced']).default('basic').describe('搜索深度：basic=快速概览，advanced=深度搜索（更慢但更全）'),
    max_results: z.number().default(5).describe('最大结果数，默认5，最多10'),
  }),
  execute: async ({ query, information, search_depth = 'basic', max_results = 5 }: { query?: string; information?: string; search_depth?: string; max_results?: number }) => {
    // Bug fix P74: AI sometimes sends 'information' instead of 'query'
    const actualQuery = query || information || '';
    if (!actualQuery) return '❌ 搜索失败: 未提供搜索关键词';
    // 1. Try Tavily first (best quality, needs API key)
    try {
      const { getApiKeyByProvider } = await import('@/lib/db');
      // Tavily key stored as provider 'tavily' in api_keys table
      const keyInfo = await getApiKeyByProvider('tavily');
      if (keyInfo && keyInfo.api_key_encrypted && keyInfo.is_active) {
        const tavilyKey = Buffer.from(keyInfo.api_key_encrypted, 'base64').toString('utf-8');
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: actualQuery,
            search_depth,
            max_results: Math.min(max_results, 10),
            include_answer: true,
            include_raw_content: false,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json() as any;
          const parts: string[] = [];
          if (data.answer) parts.push(`💡 AI摘要: ${data.answer}\n`);
          const results = (data.results || []).slice(0, max_results);
          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            parts.push(`${i + 1}. **${r.title || '无标题'}**\n   URL: ${r.url || ''}\n   ${r.content || ''}`);
          }
          if (parts.length > 0) return `🔍 搜索结果（Tavily - ${actualQuery}）:\n\n` + parts.join('\n\n');
        }
      }
    } catch (e: any) {
      // Tavily failed, fallback to Bing
    }

    // 2. Fallback: Bing HTML scraping
    try {
      const url = 'https://www.bing.com/search?q=' + encodeURIComponent(actualQuery) + '&count=' + Math.min(max_results, 10) + '&cc=cn&setmkt=zh-CN';
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const results: string[] = [];
      // Parse Bing results - extract title + snippet + URL
      const liMatches = html.matchAll(/<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g);
      let count = 0;
      for (const m of liMatches) {
        if (count >= max_results) break;
        const block = m[1];
        const titleMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a><\/h2>/) || block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/) || block.match(/<div class="b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (titleMatch) {
          count++;
          const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          const link = titleMatch[1];
          let snippet = '';
          if (snippetMatch) {
            snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
          }
          results.push(`${count}. **${title}**\n   URL: ${link}\n   ${snippet}`);
        }
      }
      if (results.length > 0) {
        // P74: Detect dictionary-like results and retry with quoted query
        const dictPattern = /^(星|即|流|梦|设|计|平|台|的|了|是|和|不|在|有|人|我|他|她|它|这|那|要|会|能|可|与|对|为|从|到|被|把|让|向|比|等|很|都|也|就|才|又|还|已|曾|正|将|最|更|太|真|好|大|小|多|少|长|短|高|低|新|旧|快|慢|早|晚|远|近|深|浅|轻|重|强|弱|冷|热|干|湿|明|暗|美|丑|善|恶|优|劣|贫|富|贵|贱|难|易|安|危|静|动|开|关|进|出|上|下|左|右|前|后|内|外|中|东|西|南|北)(_百度百科|的意思|的拼音|的部首|怎么读|的笔顺|的读音|的组词|的释义|的详细解释|的近义词|汉语文字|汉语国学|新华字典|维基百科)/;
        const isDictResults = results.length > 0 && results.every(r => dictPattern.test(r.replace(/\*\*/g, '')));
        if (isDictResults) {
          try {
            const retryUrl = 'https://www.bing.com/search?q=' + encodeURIComponent('"' + actualQuery + '"' ) + '&count=8&cc=cn&setmkt=zh-CN';
            const retryRes = await fetch(retryUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml',
              },
              signal: AbortSignal.timeout(10000),
            });
            const retryHtml = await retryRes.text();
            const retryResults: string[] = [];
            const retryMatches = [...retryHtml.matchAll(/<li class="b_algo"[^>]*>([\\s\\S]*?)<\/li>/g)];
            let retryCount = 0;
            for (const m of retryMatches) {
              if (retryCount >= max_results) break;
              const block = m[1];
              const titleMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([\\s\\S]*?)<\/a><\/h2>/) || block.match(/<a[^>]*href="([^"]*)"[^>]*>([\\s\\S]*?)<\/a>/);
              if (titleMatch) {
                retryCount++;
                const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
                const link = titleMatch[1];
                if (dictPattern.test(title)) continue;
                let snippet = '';
                const snippetMatch = block.match(/<p[^>]*>([\\s\\S]*?)<\/p>/) || block.match(/class="b_caption[^"]*"[^>]*>([\\s\\S]*?)<\/div>/);
                if (snippetMatch) snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
                retryResults.push(`${retryResults.length + 1}. **${title}**\\n   URL: ${link}${snippet ? '\\n   ' + snippet : ''}`);
              }
            }
            if (retryResults.length > 0) return `🔍 搜索结果（Bing - ${actualQuery}）：\\n\\n` + retryResults.join('\\n\\n');
          } catch {}
          return `⚠️ 搜索引擎未找到"${actualQuery}"的产品结果（返回了字典释义），该产品可能在搜索引擎中索引不足。建议：\\n1. 提供产品官网URL让我直接读取\\n2. 在后台配置Tavily API Key获得更好搜索质量\\n\\n已有搜索结果（可能不相关）：\\n\\n` + results.join('\\n\\n');
        }
        return `🔍 搜索结果（Bing - ${actualQuery}）：\\n\\n` + results.join('\\n\\n');
      }



      return '未找到相关搜索结果，请尝试换个关键词或用 readUrl 直接访问文档页面';
    } catch (e: any) {
      return `❌ 搜索失败: ${e.message || '未知错误'}。请检查网络连接或稍后重试`;
    }
  },
});

// ==================== 网页内容提取（直接fetch + 清洗） ====================
export const readUrlTool = tool({
  description: `读取网页内容，提取正文文本。支持技术文档、博客、API文档等页面。

使用场景：
- 搜索到文档链接后，读取全文获取详细信息
- 读取GitHub README、npm包文档、Stack Overflow答案
- 获取API官方文档的具体用法

注意：部分网站可能因反爬机制无法读取，此时会返回错误提示。`,
  parameters: z.object({
    url: z.string().describe('要读取的网页URL'),
    extract_mode: z.enum(['full', 'summary']).default('full').describe('提取模式：full=完整内容，summary=仅提取前2000字'),
  }),
  execute: async ({ url, extract_mode = 'full' }: { url: string; extract_mode?: string }) => {
    // P81: Empty URL guard
    if (!url || url.trim() === '' || url === 'undefined') {
      return '❌ 参数错误: url为空。请重新调用web_scrape并传入具体的网页URL';
    }
    // 1. Try Firecrawl first (if API key configured)
    try {
      const { getApiKeyByProvider } = await import('@/lib/db');
      const fcKey = process.env.FIRECRAWL_API_KEY || '';
      const fcUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v1';
      if (fcKey || true) { // Always try Firecrawl if URL is set
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (fcKey) headers['Authorization'] = `Bearer ${fcKey}`;
        const res = await fetch(`${fcUrl}/scrape`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json() as any;
          if (data.success && data.data?.markdown) {
            let content = data.data.markdown;
            if (extract_mode === 'summary' && content.length > 2000) {
              content = content.slice(0, 2000) + '\n\n... [内容已截断，使用 extract_mode=full 读取完整内容]';
            } else if (content.length > 15000) {
              content = content.slice(0, 15000) + '\n\n... [内容过长已截断]';
            }
            return `📄 ${data.data?.metadata?.title || url}\n\n${content}`;
          }
        }
      }
    } catch {}

    // 2. Fallback: Direct fetch + HTML to text
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return `❌ 读取失败: HTTP ${res.status}`;

      const contentType = res.headers.get('content-type') || '';
      let html = await res.text();

      // For non-HTML (JSON, plain text, etc)
      if (!contentType.includes('html') && !contentType.includes('xml')) {
        const text = html.slice(0, 15000);
        return `📄 ${url}\n\n${text}`;
      }

      // Strip HTML tags and clean up
      let text = html
        // Remove scripts and styles
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        // Convert some HTML to readable text
        .replace(/<h[1-6][^>]*>/gi, '\n## ')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<code[^>]*>/gi, '`')
        .replace(/<\/code>/gi, '`')
        .replace(/<pre[^>]*>/gi, '\n```\n')
        .replace(/<\/pre>/gi, '\n```\n')
        // Remove all remaining tags
        .replace(/<[^>]+>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Clean up whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : url;

      if (extract_mode === 'summary' && text.length > 2000) {
        text = text.slice(0, 2000) + '\n\n... [内容已截断，使用 extract_mode=full 读取完整内容]';
      } else if (text.length > 15000) {
        text = text.slice(0, 15000) + '\n\n... [内容过长已截断]';
      }

      return `📄 ${title}\n\n${text}`;
    } catch (e: any) {
      return `❌ 读取失败: ${e.message || '未知错误'}`;
    }
  },
});

// ==================== 图片理解工具 ====================
export const analyzeImageTool = tool({
  description: `分析图片内容，识别图片中的文字、UI元素、截图信息等。

使用场景：
- 用户上传截图，需要理解截图内容
- 分析UI设计稿，理解布局和元素
- 识别图片中的文字（OCR）
- 理解报错截图中的错误信息

注意：如果当前模型支持多模态（如gpt-4o、qwen-max等），图片会直接发给模型处理，无需调用此工具。
此工具主要用于DeepSeek等纯文本模型需要理解图片的场景。`,
  parameters: z.object({
    image_url: z.string().optional().describe('图片URL地址（公网可访问的URL）'),
    image_base64: z.string().optional().describe('图片base64编码（不含data:image/...前缀）'),
    media_type: z.string().default('image/png').describe('图片类型：image/png, image/jpeg, image/webp等'),
    question: z.string().optional().describe('关于图片的问题，如"这个报错是什么意思？"'),
  }),
  execute: async ({ image_url, image_base64, media_type = 'image/png', question }: { 
    image_url?: string; image_base64?: string; media_type?: string; question?: string 
  }) => {
    try {
      const { describeImages } = await import('@/lib/vision-proxy');
      
      let base64Data = image_base64 || '';
      
      // If URL provided, fetch and convert to base64
      if (image_url && !base64Data) {
        try {
          const imgRes = await fetch(image_url, { signal: AbortSignal.timeout(10000) });
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            base64Data = buffer.toString('base64');
          }
        } catch (e: any) {
          return `❌ 无法下载图片: ${e.message}`;
        }
      }

      if (!base64Data) {
        return '❌ 请提供 image_url 或 image_base64 参数';
      }

      const description = await describeImages(
        [{ base64Data, mediaType: media_type }],
        question
      );
      
      return description;
    } catch (e: any) {
      return `❌ 图片分析失败: ${e.message || '未知错误'}。请确认已配置支持视觉的模型API Key`;
    }
  },
});



// ============ P闭环: 自动化测试工具 ============
export const runTestsTool = tool({
  description: `运行项目的自动化测试。支持自动检测测试框架(pytest/jest/vitest/npm test)。
使用场景：代码修改后验证正确性、构建前检查、部署前回归测试。
返回测试结果摘要，包含通过/失败数量和失败详情。`,
  parameters: z.object({
    test_path: z.string().optional().describe('测试文件/目录路径，留空则自动检测'),
    framework: z.enum(['auto', 'pytest', 'jest', 'vitest', 'npm']).default('auto').describe('测试框架，默认自动检测'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    timeout: z.number().default(120).describe('超时秒数，默认120'),
  }),
  execute: async ({ test_path, framework, server, timeout }: any) => {
    // Runtime guards: AI SDK may not apply zod defaults for empty LLM input
    const srv = server || 'production';
    const fw = framework || 'auto';
    const tm = timeout || 120;
    try {
      const { sshPool } = await import('@/lib/ssh-pool');
      const cwd = process.env[srv.toUpperCase() + '_SERVER_DIR'] || '/www/wwwroot/agent.piyiguo.com';

      // Auto-detect framework
      let testCmd = '';
      if (fw === 'auto') {
        const detect = await sshPool.execute(srv, `ls package.json pytest.ini vitest.config.* jest.config.* 2>/dev/null`, { cwd });
        const files = detect.stdout;
        if (files.includes('pytest.ini') || files.includes('conftest.py')) testCmd = 'python3 -m pytest';
        else if (files.includes('vitest.config')) testCmd = 'npx vitest run';
        else if (files.includes('jest.config')) testCmd = 'npx jest --no-coverage';
        else testCmd = 'npm test -- --passWithNoTests';
      } else {
        const cmdMap: Record<string, string> = {
          pytest: 'python3 -m pytest', jest: 'npx jest --no-coverage',
          vitest: 'npx vitest run', npm: 'npm test -- --passWithNoTests',
        };
        testCmd = cmdMap[framework] || 'npm test';
      }

      if (test_path) testCmd += ' ' + test_path;
      testCmd += ' 2>&1';

      const result = await sshPool.execute(srv, testCmd, { timeout: tm * 1000, cwd });
      const output = result.stdout + (result.stderr ? '\n' + result.stderr : '');

      // Extract summary
      const lines = output.split('\n');
      const summaryLines = lines.filter((l: string) =>
        /pass|fail|error|test(s)?|✓|✗|✘|×|PASS|FAIL/i.test(l)
      ).slice(-10);

      const passed = result.code === 0;
      return (passed ? '✅ 测试通过\n' : '❌ 测试失败\n') +
        '命令: ' + testCmd + '\n' +
        (summaryLines.length > 0 ? '摘要:\n' + summaryLines.join('\n') : output.slice(-1000));
    } catch (e: any) {
      return '❌ 测试执行失败: ' + (e.message || '未知错误');
    }
  },
});

// ==================== 汇总导出 ====================
export const serverTools = {
  smart_search: smartSearchTool,
  read_url: readUrlTool,
  analyze_image: analyzeImageTool,
  ssh_execute: sshExecuteTool,
  ssh_read_file: sshReadFileTool,
  ssh_write_file: sshWriteFileTool,
  build_project: buildProjectTool,
  deploy_service: deployServiceTool,
  health_check: healthCheckTool,
  git_commit: gitCommitTool,
  diagnose_error: diagnoseErrorTool,
  run_tests: runTestsTool,
};