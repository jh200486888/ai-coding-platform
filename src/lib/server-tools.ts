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
    command: z.string().describe('要执行的shell命令'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器: production=85服务器, development=182服务器'),
    timeout: z.number().default(60).describe('超时秒数，默认60。构建等长任务设300'),
    cwd: z.string().optional().describe('工作目录，默认为项目根目录'),
  }),
  execute: async ({ command, server, timeout, cwd }: { command: string; server: 'production' | 'development'; timeout: number; cwd?: string }) => {
    for (const pattern of DANGEROUS_COMMANDS) {
      if (pattern.test(command)) {
        return '⛔ 危险命令被拦截: "' + command + '" 匹配安全黑名单规则。此操作可能导致数据丢失或系统不可用。';
      }
    }
    try {
      const result = await sshPool.execute(server, command, {
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
    path: z.string().describe('服务器上的文件绝对路径'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    startLine: z.number().optional().describe('起始行号(从0开始)，大文件分段读取'),
    endLine: z.number().optional().describe('结束行号，默认读全部'),
  }),
  execute: async ({ path, server, startLine, endLine }: { path: string; server: 'production' | 'development'; startLine?: number; endLine?: number }) => {
    try {
      let content = await sshPool.readFile(server, path);

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
    path: z.string().describe('服务器上的文件绝对路径'),
    content: z.string().describe('要写入的完整文件内容'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
    backup: z.boolean().default(true).describe('是否备份原文件，默认true'),
  }),
  execute: async ({ path, content, server, backup }: { path: string; content: string; server: 'production' | 'development'; backup?: boolean }) => {
    try {
      const result = await sshPool.writeFile(server, path, content, backup);
      let msg = `✅ 文件已写入: ${path}`;
      if (result.backupPath) {
        msg += `\n📦 备份: ${result.backupPath}`;
      }

      // 写入验证：检查文件存在 + 行数
      const expectedLines = content.split('\n').length;
      const verifyResult = await sshPool.execute(server, `wc -l < "${path}" 2>/dev/null && echo "EXISTS" || echo "MISSING"`);
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
  execute: async ({ server }: { server: 'production' | 'development' }) => {
    try {
      const result = await sshPool.execute(server,
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
  execute: async ({ server }: { server: 'production' | 'development' }) => {
    try {
      const pm2Service = server === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
      const appPort = server === 'production' ? 5000 : 5001;
      const projectDir = server === 'production' ? '/www/wwwroot/agent.piyiguo.com' : '/www/wwwroot/dev.agent.piyiguo.com';

      // 重启PM2
      const restartResult = await sshPool.execute(server, `pm2 restart ${pm2Service}`);
      if (restartResult.code !== 0) {
        return `❌ PM2重启失败: ${restartResult.stderr}`;
      }

      // 等待启动
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 健康检查（最多重试3次）
      let httpCode = '';
      for (let i = 0; i < 3; i++) {
        const healthResult = await sshPool.execute(server, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${appPort} --max-time 10`);
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
        const pm2Status = await sshPool.execute(server, `pm2 show ${pm2Service} 2>/dev/null | grep -E "status|uptime|restarts" | head -3`);
        diagnostic += `\n📊 PM2状态:\n${pm2Status.stdout.trim()}`;

        // 获取最近错误日志
        const errorLog = await sshPool.execute(server, `pm2 logs ${pm2Service} --nostream --lines 20 --err 2>/dev/null`);
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
  execute: async ({ server, checks }: { server: 'production' | 'development'; checks: Array<'http' | 'pm2' | 'disk' | 'memory' | 'db'> }) => {
    const results: string[] = [];

    try {
      if (checks.includes('http')) {
        const port = server === 'production' ? 5000 : 5001;
        const r = await sshPool.execute(server, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port} --max-time 5`);
        results.push(`HTTP: ${r.stdout.trim() === '200' || r.stdout.trim() === '302' ? '✅' : '❌'} 状态码 ${r.stdout.trim()}`);
      }

      if (checks.includes('pm2')) {
        const pm2Svc = server === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
        const r = await sshPool.execute(server, `pm2 show ${pm2Svc} 2>/dev/null | grep -E "status|uptime|restarts" | head -3`);
        results.push(`PM2: ${r.stdout.trim() || '❌ 进程未找到'}`);
      }

      if (checks.includes('disk')) {
        const r = await sshPool.execute(server, 'df -h / | tail -1');
        results.push(`磁盘: ${r.stdout.trim()}`);
      }

      if (checks.includes('memory')) {
        const r = await sshPool.execute(server, 'free -h | head -2');
        results.push(`内存:\n${r.stdout.trim()}`);
      }

      if (checks.includes('db')) {
        const port = server === 'production' ? 5432 : 5433;
        const r = await sshPool.execute(server, `PGPASSWORD=i3m8x5a2e8 psql -h 127.0.0.1 -p ${port} -U agent -d agent -c "SELECT 1" 2>&1 | head -3`);
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
  execute: async ({ message, server }: { message: string; server: 'production' | 'development' }) => {
    try {
      const statusResult = await sshPool.execute(server, 'git status --short');
      if (!statusResult.stdout.trim()) {
        return 'ℹ️ 没有需要提交的变更';
      }

      const escapedMsg = message.replace(/"/g, '\\"');
      const addResult = await sshPool.execute(server, 'git add -A');
      if (addResult.code !== 0) {
        return `❌ git add 失败: ${addResult.stderr}`;
      }

      const commitResult = await sshPool.execute(server, `git commit -m "${escapedMsg}"`);
      if (commitResult.code !== 0) {
        return `❌ git commit 失败: ${commitResult.stderr}`;
      }

      const hashResult = await sshPool.execute(server, 'git rev-parse --short HEAD');
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
  execute: async ({ server, focus }: { server: 'production' | 'development'; focus: 'build' | 'deploy' | 'runtime' | 'db' | 'all' }) => {
    const pm2Service = server === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
    const appPort = server === 'production' ? 5000 : 5001;
    const projectDir = server === 'production' ? '/www/wwwroot/agent.piyiguo.com' : '/www/wwwroot/dev.agent.piyiguo.com';
    const dbPort = server === 'production' ? 5432 : 5433;
    const results: string[] = [`🔍 深度诊断报告 [${server}服务器]\n焦点: ${focus}\n`];

    try {
      // 1. PM2状态
      if (focus === 'all' || focus === 'deploy' || focus === 'runtime') {
        const pm2Show = await sshPool.execute(server, `pm2 show ${pm2Service} 2>/dev/null | grep -E "status|uptime|restarts|memory|cpu" | head -5`);
        results.push(`📊 PM2状态:\n${pm2Show.stdout.trim() || '❌ 进程不存在'}`);

        const pm2Logs = await sshPool.execute(server, `pm2 logs ${pm2Service} --nostream --lines 30 --err 2>/dev/null`);
        if (pm2Logs.stdout.trim()) {
          results.push(`🔴 最近错误日志:\n${pm2Logs.stdout.trim().slice(0, 3000)}`);
        }
      }

      // 2. 构建产物
      if (focus === 'all' || focus === 'build' || focus === 'deploy') {
        const nextDir = await sshPool.execute(server, `ls -la ${projectDir}/.next/ 2>/dev/null | head -5`);
        results.push(`📁 构建产物:\n${nextDir.stdout.trim() || '❌ .next目录不存在，需要构建'}`);

        const buildId = await sshPool.execute(server, `cat ${projectDir}/.next/BUILD_ID 2>/dev/null`);
        results.push(`🏗️ BUILD_ID: ${buildId.stdout.trim() || '❌ 不存在'}`);
      }

      // 3. 环境配置
      if (focus === 'all' || focus === 'deploy' || focus === 'runtime') {
        const envExists = await sshPool.execute(server, `test -f ${projectDir}/.env && echo "EXISTS" || echo "MISSING"`);
        results.push(`⚙️ .env文件: ${envExists.stdout.trim()}`);

        const envKeys = await sshPool.execute(server, `grep -c "^[A-Z]" ${projectDir}/.env 2>/dev/null`);
        results.push(`📋 .env配置项数: ${envKeys.stdout.trim() || '0'}`);
      }

      // 4. 数据库
      if (focus === 'all' || focus === 'db' || focus === 'runtime') {
        const dbCheck = await sshPool.execute(server, `psql -h 127.0.0.1 -p ${dbPort} -U agent -d agent -c "SELECT count(*) FROM conversations" 2>&1 | head -3`, { timeout: 10000 });
        results.push(`🗄️ 数据库: ${dbCheck.stdout.includes('1 row') || dbCheck.stdout.includes('count') ? '✅ 连接正常' : '❌ ' + dbCheck.stdout.trim()}`);
      }

      // 5. 端口和磁盘
      if (focus === 'all' || focus === 'deploy' || focus === 'runtime') {
        const portCheck = await sshPool.execute(server, `ss -tlnp | grep ${appPort} | head -3`);
        results.push(`🔌 端口${appPort}: ${portCheck.stdout.trim() || '❌ 未监听'}`);

        const disk = await sshPool.execute(server, 'df -h / | tail -1');
        results.push(`💾 磁盘: ${disk.stdout.trim()}`);

        const mem = await sshPool.execute(server, 'free -h | grep Mem');
        results.push(`🧠 内存: ${mem.stdout.trim()}`);
      }

      results.push('\n💡 基于以上诊断结果，请分析根因并制定修复方案。');

      return results.join('\n\n');
    } catch (error) {
      return `❌ 诊断失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 汇总导出 ====================
export const serverTools = {
  ssh_execute: sshExecuteTool,
  ssh_read_file: sshReadFileTool,
  ssh_write_file: sshWriteFileTool,
  build_project: buildProjectTool,
  deploy_service: deployServiceTool,
  health_check: healthCheckTool,
  git_commit: gitCommitTool,
  diagnose_error: diagnoseErrorTool,
};
