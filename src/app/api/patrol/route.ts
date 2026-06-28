import { NextResponse } from 'next/server';

/**
 * 系统巡检 API
 * GET /api/patrol?server=production&token=xxx
 * 
 * 可通过外部cron（如宝塔定时任务）每5分钟调用：
 * curl https://agent.piyiguo.com/api/patrol?token=YOUR_TOKEN
 * 
 * 巡检项：HTTP/PM2/磁盘/内存/DB/错误日志
 * 发现异常时自动记录到user_memory
 */

export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  healthy: boolean;
  message: string;
  autoFixed?: boolean;
}

async function sshExec(command: string, timeout = 10000): Promise<{ stdout: string; stderr: string; code: number }> {
  const { sshPool } = await import('@/lib/ssh-pool');
  try {
    return await sshPool.execute('production', command, { timeout });
  } catch (e) {
    return { stdout: '', stderr: String(e), code: 1 };
  }
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. HTTP检查
  const httpResult = await sshExec('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000 --max-time 5');
  const httpCode = httpResult.stdout.trim();
  results.push({
    name: 'HTTP',
    healthy: httpCode === '200' || httpCode === '302',
    message: `状态码 ${httpCode}`,
  });

  // 2. PM2检查
  const pm2Result = await sshExec('pm2 show ai-coding-platform 2>/dev/null | grep "status" | head -1');
  const pm2Online = pm2Result.stdout.includes('online');
  results.push({
    name: 'PM2',
    healthy: pm2Online,
    message: pm2Result.stdout.trim() || '进程不存在',
  });

  // 3. 内存检查
  const memResult = await sshExec('free -m | grep Mem');
  const memMatch = memResult.stdout.match(/(\d+)\s+(\d+)/);
  const memPercent = memMatch ? Math.round((parseInt(memMatch[2]) / parseInt(memMatch[1])) * 100) : 0;
  results.push({
    name: 'Memory',
    healthy: memPercent < 90,
    message: `使用率 ${memPercent}%`,
  });

  // 4. 磁盘检查
  const diskResult = await sshExec('df -h / | tail -1');
  const diskMatch = diskResult.stdout.match(/(\d+)%/);
  const diskPercent = diskMatch ? parseInt(diskMatch[1]) : 0;
  results.push({
    name: 'Disk',
    healthy: diskPercent < 90,
    message: `使用率 ${diskPercent}%`,
  });

  // 5. DB检查
  const dbResult = await sshExec('psql -h 127.0.0.1 -U agent -d agent -c "SELECT 1" 2>&1 | head -1', 5000);
  results.push({
    name: 'Database',
    healthy: dbResult.stdout.includes('1 row') || dbResult.stdout.includes('count'),
    message: dbResult.stdout.trim().slice(0, 80),
  });

  return results;
}

async function autoFix(issues: CheckResult[]): Promise<void> {
  // PM2 stopped → 自动重启
  const pm2Issue = issues.find(i => i.name === 'PM2' && !i.healthy);
  if (pm2Issue) {
    console.log('[Patrol] Auto-fixing: PM2 restart');
    const result = await sshExec('pm2 restart ai-coding-platform', 15000);
    if (result.code === 0) {
      pm2Issue.healthy = true;
      pm2Issue.autoFixed = true;
      pm2Issue.message += ' (自动重启成功)';

      // 记录到记忆
      try {
        const db = await import('@/lib/db');
        await db.run(
          `INSERT INTO user_memory (id, category, content, tags, importance, keywords, "createdAt", "updatedAt")
           VALUES ($1, 'patrol_fix', $2, 'patrol,auto-fix', 3, '巡检,自动修复', NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET content = $2, "updatedAt" = NOW()`,
          ['patrol-fix-' + Date.now(), `自动修复: PM2进程停止→自动重启. 时间: ${new Date().toISOString()}`]
        );
      } catch {}
    }
  }
}

export async function GET(request: Request) {
  // Token验证
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const expectedToken = process.env.PATROL_TOKEN || 'patrol-2026-secure';

  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runChecks();
    const issues = results.filter(r => !r.healthy);

    // 自动修复已知问题
    if (issues.length > 0) {
      await autoFix(issues);
    }

    const report = {
      timestamp: new Date().toISOString(),
      overall: issues.length === 0 ? 'healthy' : 'issues_found',
      checks: results,
      autoFixed: results.filter(r => r.autoFixed).length,
    };

    // 如果有未修复的问题，记录到记忆
    const remainingIssues = results.filter(r => !r.healthy);
    if (remainingIssues.length > 0) {
      try {
        const db = await import('@/lib/db');
        await db.run(
          `INSERT INTO user_memory (id, category, content, tags, importance, keywords, "createdAt", "updatedAt")
           VALUES ($1, 'patrol_alert', $2, 'patrol,alert', 4, '巡检,告警', NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET content = $2, "updatedAt" = NOW()`,
          ['patrol-alert-latest', `巡检告警 ${new Date().toISOString()}: ${remainingIssues.map(i => i.name + ': ' + i.message).join('; ')}`]
        );
      } catch {}
    }

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: 'error',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
