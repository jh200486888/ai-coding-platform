// @ts-nocheck
/**
 * Cron Scheduler API - 定时任务调度端点
 * 被 PM2 cron 或外部定时器调用，检查并执行到期任务
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDueTasks, markTaskRun, initScheduledTasksTable } from '@/lib/agent-state';
import { getSetting } from '@/lib/db';
import { logger } from '@/lib/logger';

// 安全验证：从DB读取cron_secret，fallback到环境变量和默认值

export async function GET(request: NextRequest) {
  // 验证secret
  const secret = request.nextUrl.searchParams.get('secret');
  // 从DB读取cron_secret
  let cronSecret = process.env.CRON_SECRET || 'ai-platform-cron-2026';
  try {
    const advStr = await getSetting('advanced_config');
    if (advStr) {
      const match = advStr.match(/cron_secret:\s*([^,}]+)/);
      if (match) cronSecret = match[1].trim();
    }
  } catch {}
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initScheduledTasksTable();
    
    // ====== 心跳巡检（每次cron都执行） ======
    const heartbeatResult = await runHeartbeatCheck();
    
    const dueTasks = await getDueTasks();
    
    if (dueTasks.length === 0) {
      return NextResponse.json({ 
        status: 'ok', 
        tasks_executed: 0, 
        message: 'No due tasks',
        heartbeat: heartbeatResult,
      });
    }

    const results: any[] = [];
    
    for (const task of dueTasks) {
      try {
        logger.info(`[Cron] Executing task: ${task.task_name} (${task.id})`);
        
        const executeResult = await executeScheduledTask(task);
        
        await markTaskRun(task.id, executeResult);
        results.push({ task_id: task.id, task_name: task.task_name, status: 'executed', result: executeResult.slice(0, 200) });
      } catch (e: any) {
        await markTaskRun(task.id, `ERROR: ${e.message}`);
        results.push({ task_id: task.id, task_name: task.task_name, status: 'error', error: e.message });
      }
    }

    return NextResponse.json({ 
      status: 'ok', 
      tasks_executed: results.length, 
      results,
      heartbeat: heartbeatResult,
    });
  } catch (e: any) {
    logger.error(`[Cron] Scheduler error: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function executeScheduledTask(task: any): Promise<string> {
  // 使用内部chat API执行任务
  const baseUrl = process.env.DEPLOY_RUN_PORT 
    ? `http://localhost:${process.env.DEPLOY_RUN_PORT}` 
    : 'http://localhost:5000';

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: task.conversation_id || undefined,
        model_id: 'deepseek-v4-flash',
        mode: 'coding',
        messages: [{
          role: 'user',
          content: `[定时任务] ${task.task_name}\n\n${task.task_description}\n\n请执行以上定时任务。`
        }],
        enable_search: true,
      }),
    });

    if (!response.ok) {
      return `API调用失败: HTTP ${response.status}`;
    }

    // 读取streaming response的文本
    const text = await response.text();
    // 提取有用的内容（去除SSE格式）
    const contentMatches = text.match(/"delta":"([^"]*)"/g) || [];
    const extracted = contentMatches.map(m => {
      const match = m.match(/"delta":"([^"]*)"/);
      return match ? match[1] : '';
    }).join('');
    
    return extracted.slice(0, 1000) || '任务已触发执行';
  } catch (e: any) {
    return `执行失败: ${e.message}`;
  }
}


// ============ 心跳巡检 ============
async function runHeartbeatCheck(): Promise<{
  checked: boolean;
  health: 'ok' | 'warning' | 'error';
  issues: string[];
  actions_taken: string[];
}> {
  const issues: string[] = [];
  const actions: string[] = [];
  const startTime = Date.now();
  
  try {
    const { query, queryOne, run } = await import('@/lib/db');
    
    // 1. 服务健康检查
    try {
      const baseUrl = process.env.DEPLOY_RUN_PORT 
        ? `http://localhost:${process.env.DEPLOY_RUN_PORT}` 
        : 'http://localhost:5000';
      const healthResp = await fetch(`${baseUrl}/api/models`, { 
        signal: AbortSignal.timeout(5000) 
      });
      if (!healthResp.ok) {
        issues.push('服务健康检查失败: HTTP ' + healthResp.status);
      }
    } catch (e: any) {
      issues.push('服务不可达: ' + e.message);
    }
    
    // 2. 检查卡住的Agent状态
    try {
      const stuckThreshold = 3;
      const stuckStates = await query(
        "SELECT conversation_id, phase, current_task, error_count, updated_at FROM agent_state WHERE phase = $1 AND error_count >= $2 AND updated_at > NOW() - INTERVAL '1 hour'",
        ['stuck', stuckThreshold]
      );
      for (const s of stuckStates) {
        issues.push('对话 ' + s.conversation_id.slice(0, 8) + ' 卡住: ' + (s.current_task || '').slice(0, 50) + ' (错误' + s.error_count + '次)');
      }
      // Auto-reset stuck states older than 2 hours
      const resetResult = await run(
        "UPDATE agent_state SET phase = $1, error_count = 0, blocked_reason = NULL WHERE phase = $2 AND updated_at < NOW() - INTERVAL '2 hours'",
        ['idle', 'stuck']
      );
      if (resetResult?.rowCount && resetResult.rowCount > 0) {
        actions.push('自动重置 ' + resetResult.rowCount + ' 个过期卡住状态');
      }
    } catch (e: any) {
      // agent_state table might not exist yet
    }
    
    // 3. 检查即将到期的定时任务
    try {
      const upcoming = await query(
        "SELECT id, task_name, next_run_at FROM scheduled_tasks WHERE status = $1 AND next_run_at IS NOT NULL AND next_run_at <= NOW() + INTERVAL '5 minutes' AND next_run_at > NOW() ORDER BY next_run_at ASC LIMIT 5",
        ['active']
      );
      if (upcoming.length > 0) {
        actions.push(upcoming.length + '个定时任务即将执行');
      }
    } catch (e: any) {}
    
    // 4. 检查PM2进程状态
    try {
      const { execSync } = await import('child_process');
      const pm2Output = execSync('pm2 jlist 2>/dev/null || echo "[]"', { encoding: 'utf-8', timeout: 5000 });
      const pm2List = JSON.parse(pm2Output);
      for (const proc of pm2List) {
        if (proc.pm2_env?.status !== 'online') {
          issues.push('PM2进程 ' + proc.name + ' 状态异常: ' + proc.pm2_env?.status);
        }
        if (proc.pm2_env?.restart_time > 5) {
          issues.push('PM2进程 ' + proc.name + ' 重启次数异常: ' + proc.pm2_env.restart_time);
        }
      }
    } catch (e: any) {}
    
    // 5. 计算健康状态
    const health = issues.length === 0 ? 'ok' : issues.some(i => i.includes('不可达') || i.includes('异常')) ? 'error' : 'warning';
    const duration = Date.now() - startTime;
    
    // 6. 写入心跳日志（每次都写，供后台趋势图用）
    try {
      await run(
        'INSERT INTO heartbeat_logs (health, issues_count, issues, actions, tasks_executed, check_duration_ms) VALUES ($1, $2, $3, $4, $5, $6)',
        [health, issues.length, JSON.stringify(issues), JSON.stringify(actions), 0, duration]
      );
    } catch (e: any) {}
    
    // 7. 有问题时写通知
    if (issues.length > 0) {
      try {
        await run(
          "INSERT INTO agent_notifications (id, type, message, severity, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING",
          ['hb_' + Date.now(), 'heartbeat', issues.join('; '), issues.some(i => i.includes('不可达')) ? 'error' : 'warning']
        );
      } catch (e: any) {}
    }
    
    // 8. 记忆维护（自动过期+降级）
    try {
      // Clean up expired short_term memories
      const expiredResult = await run(
        "DELETE FROM user_memory WHERE memory_tier = 'short_term' AND expires_at IS NOT NULL AND expires_at < NOW()"
      );
      if (expiredResult?.rowCount && expiredResult.rowCount > 0) {
        actions.push('清理 ' + expiredResult.rowCount + ' 条过期短期记忆');
      }
      // Demote mid_term memories not accessed in 7 days
      const demotedResult = await run(
        "UPDATE user_memory SET memory_tier = 'long_term' WHERE memory_tier = 'mid_term' AND last_accessed_at < NOW() - INTERVAL '7 days'"
      );
      if (demotedResult?.rowCount && demotedResult.rowCount > 0) {
        actions.push('降级 ' + demotedResult.rowCount + ' 条中期记忆为长期');
      }
    } catch (e: any) {}

    // 9. 清理7天前的日志
    try {
      await run("DELETE FROM heartbeat_logs WHERE created_at < NOW() - INTERVAL '7 days'");
      await run("DELETE FROM agent_notifications WHERE acknowledged = TRUE AND created_at < NOW() - INTERVAL '30 days'");
    } catch (e: any) {}
    
    return {
      checked: true,
      health,
      issues,
      actions_taken: actions,
    };
  } catch (e: any) {
    return {
      checked: false,
      health: 'error',
      issues: ['心跳巡检异常: ' + e.message],
      actions_taken: [],
    };
  }
}
