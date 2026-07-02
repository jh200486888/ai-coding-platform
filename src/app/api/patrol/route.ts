import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { isAdminAuthenticated } from '@/lib/auth';

/**
 * 系统巡检 API
 * GET /api/patrol?server=production&token=xxx
 * 
 * server参数：production（85主服务器）或 development（182开发服务器）
 * 默认production
 * 
 * 巡检项：HTTP/PM2/磁盘/内存/DB
 * 发现异常时自动记录到user_memory
 */

export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  healthy: boolean;
  message: string;
  autoFixed?: boolean;
}

interface ServerCheckConfig {
  serverId: string;
  appPort: number;
  pm2Service: string;
  dockerContainer?: string;  // 如果用Docker运行，PM2命令需要docker exec
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbName: string;
  dbPassword: string;
}

function getServerConfig(server: string): ServerCheckConfig {
  const envPrefix = server.toUpperCase();
  const dockerContainer = process.env[`${envPrefix}_DOCKER_CONTAINER`] || '';
  return {
    serverId: server,
    appPort: parseInt(process.env[`${envPrefix}_APP_PORT`] || (server === 'production' ? '5000' : '5001')),
    pm2Service: process.env[`${envPrefix}_PM2_SERVICE`] || 'ai-coding-platform',
    dockerContainer: dockerContainer || undefined,
    dbHost: process.env[`${envPrefix}_DB_HOST`] || process.env.DB_HOST || '127.0.0.1',
    dbPort: parseInt(process.env[`${envPrefix}_DB_PORT`] || process.env.DB_PORT || '5432'),
    dbUser: process.env.DB_USER || 'agent',
    dbName: process.env.DB_NAME || 'agent',
    dbPassword: process.env.DB_PASSWORD || 'i3m8x5a2e8',
  };
}

async function sshExec(serverId: string, command: string, timeout = 10000): Promise<{ stdout: string; stderr: string; code: number }> {
  // 如果目标服务器就是本机，直接本地执行不走SSH
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  const selfServer = appUrl.includes('dev.') ? 'development' : 'production';
  
  if (serverId === selfServer) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(command, { timeout });
      return { stdout, stderr: '', code: 0 };
    } catch (e: any) {
      return { stdout: e.stdout || '', stderr: e.stderr || String(e), code: e.code || 1 };
    }
  }

  const { sshPool } = await import('@/lib/ssh-pool');
  try {
    return await sshPool.execute(serverId, command, { timeout });
  } catch (e) {
    return { stdout: '', stderr: String(e), code: 1 };
  }
}

/** 根据是否Docker部署和是否本机，包装PM2命令 */
function pm2Cmd(config: ServerCheckConfig, cmd: string, isLocal: boolean): string {
  // 本机执行时不需要docker exec（已在容器内）
  if (config.dockerContainer && !isLocal) {
    return `docker exec ${config.dockerContainer} ${cmd}`;
  }
  return cmd;
}

async function runChecks(config: ServerCheckConfig, isLocal: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { serverId, appPort, pm2Service, dbHost, dbPort, dbUser, dbName, dbPassword } = config;

  // 1. HTTP检查（本机用fetch，远程用curl）
  let httpHealthy = false;
  let httpMsg = '';
  if (isLocal) {
    try {
      const resp = await fetch(`http://127.0.0.1:${appPort}`, { signal: AbortSignal.timeout(5000) });
      httpHealthy = resp.ok || resp.status === 302;
      httpMsg = `状态码 ${resp.status}`;
    } catch (e: any) {
      httpMsg = `连接失败 ${e.message || ''}`;
    }
  } else {
    const httpResult = await sshExec(serverId, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${appPort} --max-time 5`);
    const httpCode = httpResult.stdout.trim();
    httpHealthy = httpCode === '200' || httpCode === '302';
    httpMsg = `状态码 ${httpCode}`;
  }
  results.push({
    name: 'HTTP',
    healthy: httpHealthy,
    message: httpMsg,
  });

  // 2. PM2检查（Docker环境用docker exec，本机直接执行）
  const pm2CheckCmd = pm2Cmd(config, `pm2 show ${pm2Service} 2>/dev/null | grep "status" | head -1`, isLocal);
  const pm2Result = await sshExec(serverId, pm2CheckCmd);
  const pm2Online = pm2Result.stdout.includes('online');
  results.push({
    name: 'PM2',
    healthy: pm2Online,
    message: pm2Result.stdout.trim() || '进程不存在',
  });

  // 3. 内存检查（本机用os模块，远程用free）
  let memPercent = 0;
  if (isLocal) {
    const os = await import('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
  } else {
    const memResult = await sshExec(serverId, 'free -m | grep Mem');
    const memMatch = memResult.stdout.match(/(\d+)\s+(\d+)/);
    memPercent = memMatch ? Math.round((parseInt(memMatch[2]) / parseInt(memMatch[1])) * 100) : 0;
  }
  results.push({
    name: 'Memory',
    healthy: memPercent < 90,
    message: `使用率 ${memPercent}%`,
  });

  // 4. 磁盘检查（本机用df，远程也用df）
  let diskPercent = 0;
  const diskCmd = "df -h / | tail -1 | awk '{print $5}' | tr -d '%'";
  if (isLocal) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(diskCmd, { timeout: 5000 });
      diskPercent = parseInt(stdout.trim()) || 0;
    } catch {
      diskPercent = 0;
    }
  } else {
    const diskResult = await sshExec(serverId, 'df -h / | tail -1');
    const diskMatch = diskResult.stdout.match(/(\d+)%/);
    diskPercent = diskMatch ? parseInt(diskMatch[1]) : 0;
  }
  results.push({
    name: 'Disk',
    healthy: diskPercent < 90,
    message: `使用率 ${diskPercent}%`,
  });

  // 5. DB检查（本机用DB连接池，远程用psql命令）
  let dbHealthy = false;
  let dbMsg = '';
  if (isLocal) {
    try {
      const db = await import('@/lib/db');
      const result = await db.query('SELECT 1 as ok');
      dbHealthy = true;
      dbMsg = '连接正常';
    } catch (e: any) {
      dbMsg = `连接失败 ${e.message || ''}`.slice(0, 80);
    }
  } else {
    const dbResult = await sshExec(serverId, `PGPASSWORD=${dbPassword} psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "SELECT 1 as ok" 2>&1`, 5000);
    dbHealthy = dbResult.stdout.includes('1 row') || dbResult.stdout.includes('ok') || dbResult.stdout.includes('count');
    dbMsg = dbResult.stdout.trim().slice(0, 80);
  }
  results.push({
    name: 'Database',
    healthy: dbHealthy,
    message: dbMsg,
  });

  return results;
}

async function autoFix(config: ServerCheckConfig, issues: CheckResult[], isLocal: boolean): Promise<void> {
  const pm2Issue = issues.find(i => i.name === 'PM2' && !i.healthy);
  if (pm2Issue) {
    logger.info('[Patrol] Auto-fixing: PM2 restart');
    const restartCmd = pm2Cmd(config, `pm2 restart ${config.pm2Service}`, isLocal);
    const result = await sshExec(config.serverId, restartCmd, 15000);
    if (result.code === 0) {
      pm2Issue.healthy = true;
      pm2Issue.autoFixed = true;
      pm2Issue.message += ' (自动重启成功)';

      try {
        const db = await import('@/lib/db');
        await db.run(
          `INSERT INTO user_memory (id, category, content, tags, importance, keywords, "createdAt", "updatedAt")
           VALUES ($1, 'patrol_fix', $2, 'patrol,auto-fix', 3, '巡检,自动修复', NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET content = $2, "updatedAt" = NOW()`,
          ['patrol-fix-' + Date.now(), `自动修复: PM2进程停止→自动重启. 服务器: ${config.serverId}, 时间: ${new Date().toISOString()}`]
        );
      } catch {}
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const isTokenValid = token === 'patrol-2026-secure';
  if (!isTokenValid && !(await isAdminAuthenticated())) { 
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); 
  }

  try {
    // 从URL参数获取server，自动检测当前服务器身份
    let server = url.searchParams.get('server') || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    const selfServer = appUrl.includes('dev.') ? 'development' : 'production';
    if (!server) {
      server = selfServer;
    }
    const isLocal = server === selfServer;
    
    const config = getServerConfig(server);
    
    const results = await runChecks(config, isLocal);
    const issues = results.filter(r => !r.healthy);

    if (issues.length > 0) {
      await autoFix(config, issues, isLocal);
    }

    const report = {
      timestamp: new Date().toISOString(),
      server,
      overall: issues.length === 0 ? 'healthy' : 'issues_found',
      checks: results,
      autoFixed: results.filter(r => r.autoFixed).length,
    };

    const remainingIssues = results.filter(r => !r.healthy);
    if (remainingIssues.length > 0) {
      try {
        const db = await import('@/lib/db');
        await db.run(
          `INSERT INTO user_memory (id, category, content, tags, importance, keywords, "createdAt", "updatedAt")
           VALUES ($1, 'patrol_alert', $2, 'patrol,alert', 4, '巡检,告警', NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET content = $2, "updatedAt" = NOW()`,
          ['patrol-alert-latest', `巡检告警 [${server}] ${new Date().toISOString()}: ${remainingIssues.map(i => i.name + ': ' + i.message).join('; ')}`]
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
