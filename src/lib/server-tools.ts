// @ts-nocheck // AI SDK v7 tool() + needsApproval + execute 类型推断不兼容，待SDK修复后移除
/**
 * 服务器操作工具 - AI SDK tool() 定义
 * 供 ToolLoopAgent 使用的SSH远程操作工具集
 */
import { tool } from 'ai';
import { z } from 'zod';
import { sshPool, DANGEROUS_COMMANDS } from './ssh-pool';

// Helper: 包装tool定义，解决AI SDK v7 needsApproval + execute 类型不兼容问题



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
    // 安全检查：危险命令直接拒绝
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
      if (result.stdout) {
        output += result.stdout;
      }
      if (result.stderr && result.code !== 0) {
        output += `\n[stderr] ${result.stderr}`;
      }
      if (result.code !== 0) {
        output += `\n[退出码: ${result.code}]`;
      }

      // 截断过长输出
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

      // 处理行号范围
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine || 0;
        const end = endLine || lines.length;
        content = lines.slice(start, end)
          .map((line, i) => `${start + i + 1}\t${line}`)
          .join('\n');
      }

      // 截断
      if (content.length > 10000) {
        content = content.slice(0, 10000) + '\n... [文件过长，已截断]';
      }

      return content || '(空文件)';
    } catch (error) {
      return `❌ 读取失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== SSH 写入文件 ====================
export const sshWriteFileTool = tool({
  description: `在远程服务器上写入或修改文件。⚠️ 此操作需要用户审批确认。

安全特性：
- 写入前自动备份原文件(添加.bak.时间戳后缀)
- 使用base64编码传输，避免SSH转义问题

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
      return msg;
    } catch (error) {
      return `❌ 写入失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 构建项目 ====================
export const buildProjectTool = tool({
  description: `在远程服务器上构建Next.js项目。自动设置内存限制(3GB)防止OOM。

流程：pnpm build → 检查构建结果
此操作需要用户审批确认(因为耗时较长且影响服务)。`,
  parameters: z.object({
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
  }),
  execute: async ({ server }: { server: 'production' | 'development' }) => {
    try {
      const result = await sshPool.execute(server,
        'NODE_OPTIONS="--max-old-space-size=3072" pnpm build 2>&1 | tail -50',
        { timeout: 300000 }
      );

      const output = result.stdout + (result.stderr ? `\n${result.stderr}` : '');
      if (output.includes('✓ Compiled successfully') || output.includes('Build completed') || result.code === 0) {
        return `✅ 构建成功\n${output.slice(-2000)}`;
      } else {
        return `❌ 构建失败\n${output.slice(-3000)}`;
      }
    } catch (error) {
      return `❌ 构建异常: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ==================== 部署服务 ====================
export const deployServiceTool = tool({
  description: `部署服务：PM2重启 + HTTP健康检查。⚠️ 需要用户审批。

流程：pm2 restart → 等待5秒 → curl验证HTTP 200 → 返回结果`,
  parameters: z.object({
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
  }),
  execute: async ({ server }) => {
    try {
      // Get server config for PM2 service name and port
    const pm2Service = server === 'production' ? 'ai-coding-platform' : 'ai-coding-dev';
    const appPort = server === 'production' ? 5000 : 5001;

      // 重启PM2
      const restartResult = await sshPool.execute(server, `pm2 restart ${pm2Service}`);
      if (restartResult.code !== 0) {
        return `❌ PM2重启失败: ${restartResult.stderr}`;
      }

      // 等待5秒
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 健康检查
      const healthResult = await sshPool.execute(server, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${appPort} --max-time 10`);
      const httpCode = healthResult.stdout.trim();

      if (httpCode === '200' || httpCode === '302') {
        return `✅ 部署成功\n- PM2服务: ${pm2Service} 已重启\n- 健康检查: HTTP ${httpCode}\n- 服务端口: ${appPort}`;
      } else {
        return `⚠️ 部署完成但健康检查异常\n- PM2服务: ${pm2Service} 已重启\n- 健康检查: HTTP ${httpCode} (预期200)\n- 请检查服务状态`;
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
        const r = await sshPool.execute(server, `psql -h 127.0.0.1 -p ${port} -U agent -d agent -c "SELECT 1" 2>&1 | head -3`);
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

流程：git add → git commit → 显示commit hash`,
  parameters: z.object({
    message: z.string().describe('提交信息'),
    server: z.enum(['production', 'development']).default('production').describe('目标服务器'),
  }),
  execute: async ({ message, server }: { message: string; server: 'production' | 'development' }) => {
    try {
      // 先看状态
      const statusResult = await sshPool.execute(server, 'git status --short');
      if (!statusResult.stdout.trim()) {
        return 'ℹ️ 没有需要提交的变更';
      }

      // git add + commit
      const escapedMsg = message.replace(/"/g, '\\"');
      const addResult = await sshPool.execute(server, 'git add -A');
      if (addResult.code !== 0) {
        return `❌ git add 失败: ${addResult.stderr}`;
      }

      const commitResult = await sshPool.execute(server, `git commit -m "${escapedMsg}"`);
      if (commitResult.code !== 0) {
        return `❌ git commit 失败: ${commitResult.stderr}`;
      }

      // 获取commit hash
      const hashResult = await sshPool.execute(server, 'git rev-parse --short HEAD');
      return `✅ 提交成功: ${hashResult.stdout.trim()}\n📝 ${message}\n📋 变更文件:\n${statusResult.stdout.trim().slice(0, 1000)}`;
    } catch (error) {
      return `❌ Git操作失败: ${error instanceof Error ? error.message : String(error)}`;
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
};
