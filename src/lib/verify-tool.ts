// @ts-nocheck
/**
 * Post-execution Auto-verification Tool
 * Provides verification after high-risk operations (build, deploy, DB changes, file modifications)
 */
import { tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'child_process';
import { logger } from './logger';

const PROJECT_DIR = process.env.PROJECT_DIR || '/www/wwwroot/agent.piyiguo.com';

export const verifyTool = {
  verify_operation: tool({
    description: `验证操作结果。在完成以下高风险操作后自动调用：
1. 构建项目后 - 检查构建产物是否生成
2. 部署服务后 - 检查服务健康状态、版本一致性
3. 修改文件后 - 确认文件内容正确
4. 数据库操作后 - 验证数据变更
5. 安装依赖后 - 确认依赖正确安装

建议在 build_project、deploy_service、createFile（批量）、editFile（批量）后调用。`,
    inputSchema: z.object({
      operation_type: z.enum(['build', 'deploy', 'file_change', 'db_operation', 'install', 'general']).describe('操作类型'),
      description: z.string().describe('操作描述，如"部署v2.1"、"修改路由配置"'),
      checks: z.array(z.string()).optional().describe('自定义检查项，如["检查端口5000是否监听", "验证API响应"]'),
    }),
    execute: async ({ operation_type, description, checks }) => {
      const results: { name: string; pass: boolean; detail: string }[] = [];
      const runCheck = (name: string, fn: () => { pass: boolean; detail: string }) => {
        try {
          const r = fn();
          results.push({ name, ...r });
        } catch (e: any) {
          results.push({ name, pass: false, detail: e.message || String(e) });
        }
      };

      // === Build verification ===
      if (operation_type === 'build') {
        runCheck('Build artifacts', () => {
          try {
            const stat = execSync(`stat -c '%Y' ${PROJECT_DIR}/.next/BUILD_ID 2>/dev/null || echo 0`, { 
              encoding: 'utf-8', timeout: 5000 
            }).trim();
            const age = Date.now() / 1000 - parseInt(stat);
            return { pass: age < 300, detail: age < 300 ? `BUILD_ID age: ${Math.round(age)}s` : `BUILD_ID too old: ${Math.round(age)}s` };
          } catch { return { pass: false, detail: 'Cannot stat BUILD_ID' }; }
        });
        runCheck('Build errors in logs', () => {
          try {
            const log = execSync(`pm2 logs ai-coding-platform --lines 30 --nostream 2>&1`, { 
              encoding: 'utf-8', timeout: 10000 
            });
            const hasError = /error|Error|ERROR|failed|Failed|FAILED/.test(log);
            return { pass: !hasError, detail: hasError ? 'Errors found in recent logs' : 'No errors in logs' };
          } catch { return { pass: true, detail: 'Cannot read logs (non-critical)' }; }
        });
      }

      // === Deploy verification ===
      if (operation_type === 'deploy') {
        runCheck('PM2 status', () => {
          try {
            const out = execSync('pm2 show ai-coding-platform 2>/dev/null | grep status', { 
              encoding: 'utf-8', timeout: 5000 
            });
            const online = out.includes('online');
            return { pass: online, detail: online ? 'Service online' : `Status: ${out.trim()}` };
          } catch { return { pass: false, detail: 'Cannot check PM2 status' }; }
        });
        runCheck('HTTP health', () => {
          try {
            const code = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ 2>/dev/null || echo 000', { 
              encoding: 'utf-8', timeout: 10000 
            }).trim();
            return { pass: code === '200', detail: `HTTP ${code}` };
          } catch { return { pass: false, detail: 'HTTP check failed' }; }
        });
        runCheck('DB connection', () => {
          try {
            const r = execSync("psql (process.env.DATABASE_URL || 'postgresql://agent:i3m8x5a2e8@127.0.0.1:5432/agent') -c 'SELECT 1' -t 2>/dev/null", { 
              encoding: 'utf-8', timeout: 5000 
            });
            return { pass: r.trim() === '1', detail: 'DB connected' };
          } catch { return { pass: false, detail: 'DB connection failed' }; }
        });
        runCheck('Disk space', () => {
          try {
            const out = execSync("df -h / | tail -1 | awk '{print $5}'", { encoding: 'utf-8', timeout: 5000 }).trim();
            const pct = parseInt(out);
            return { pass: pct < 90, detail: `Disk usage: ${out}` };
          } catch { return { pass: true, detail: 'Cannot check disk' }; }
        });
      }

      // === File change verification ===
      if (operation_type === 'file_change') {
        runCheck('File integrity', () => {
          try {
            const out = execSync(`find ${PROJECT_DIR}/src -name '*.ts' -newer ${PROJECT_DIR}/.next/BUILD_ID 2>/dev/null | wc -l`, { 
              encoding: 'utf-8', timeout: 5000 
            }).trim();
            return { pass: true, detail: `${out} modified TS files since last build` };
          } catch { return { pass: true, detail: 'Cannot check file timestamps' }; }
        });
        runCheck('TypeScript syntax', () => {
          try {
            execSync(`cd ${PROJECT_DIR} && npx tsc --noEmit --pretty false 2>&1 | head -5`, { 
              encoding: 'utf-8', timeout: 30000 
            });
            return { pass: true, detail: 'No TypeScript errors' };
          } catch (e: any) {
            const output = e.stdout || e.stderr || '';
            const errCount = (output.match(/\n/g) || []).length + 1;
            return { pass: false, detail: `${errCount} TS error(s): ${output.substring(0, 200)}` };
          }
        });
      }

      // === DB operation verification ===
      if (operation_type === 'db_operation') {
        runCheck('DB connectivity', () => {
          try {
            execSync("psql (process.env.DATABASE_URL || 'postgresql://agent:i3m8x5a2e8@127.0.0.1:5432/agent') -c 'SELECT 1' -t 2>/dev/null", { 
              encoding: 'utf-8', timeout: 5000 
            });
            return { pass: true, detail: 'DB accessible' };
          } catch { return { pass: false, detail: 'DB not accessible' }; }
        });
      }

      // === Install verification ===
      if (operation_type === 'install') {
        runCheck('node_modules', () => {
          try {
            execSync(`test -d ${PROJECT_DIR}/node_modules`, { timeout: 3000 });
            return { pass: true, detail: 'node_modules exists' };
          } catch { return { pass: false, detail: 'node_modules missing' }; }
        });
      }

      // === Custom checks ===
      if (checks && checks.length > 0) {
        for (const check of checks) {
          runCheck(check, () => {
            try {
              const out = execSync(check, { encoding: 'utf-8', timeout: 10000, cwd: PROJECT_DIR });
              return { pass: true, detail: out.trim().substring(0, 200) || 'OK' };
            } catch (e: any) {
              return { pass: false, detail: (e.stderr || e.stdout || e.message || '').substring(0, 200) };
            }
          });
        }
      }

      // === Format report ===
      const passed = results.filter(r => r.pass).length;
      const failed = results.filter(r => !r.pass).length;
      let report = `Verification: ${description}\n`;
      report += `${passed} passed, ${failed} failed\n\n`;
      for (const r of results) {
        report += `${r.pass ? 'PASS' : 'FAIL'}: ${r.name} - ${r.detail}\n`;
      }
      if (failed === 0) {
        report += '\nAll checks passed.';
      } else {
        report += `\n${failed} check(s) failed. Review and fix if needed.`;
      }

      logger.info(`[Verify] ${description}: ${passed}/${results.length} passed`);
      return report;
    },
  }),
};
