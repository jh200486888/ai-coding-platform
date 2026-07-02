// @ts-nocheck
/**
 * Heartbeat API - 心跳巡检数据接口
 * 供后台管理页面查询心跳日志和通知
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, run, queryOne } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const type = request.nextUrl.searchParams.get('type') || 'overview';
    
    if (type === 'overview') {
      // 1. 最近一次心跳状态
      const lastBeat = await queryOne(
        "SELECT * FROM heartbeat_logs ORDER BY created_at DESC LIMIT 1"
      );
      
      // 2. 24小时心跳统计
      const stats24h = await queryOne(
        `SELECT 
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE health = 'ok') as ok_count,
          COUNT(*) FILTER (WHERE health = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE health = 'error') as error_count,
          AVG(check_duration_ms)::int as avg_duration_ms
        FROM heartbeat_logs WHERE created_at > NOW() - INTERVAL '24 hours'`
      );
      
      // 3. 24小时趋势（每小时聚合）
      const trend = await query(
        `SELECT 
          date_trunc('hour', created_at) as hour,
          COUNT(*) as checks,
          COUNT(*) FILTER (WHERE health = 'ok') as ok,
          COUNT(*) FILTER (WHERE health = 'warning') as warnings,
          COUNT(*) FILTER (WHERE health = 'error') as errors,
          AVG(check_duration_ms)::int as avg_ms
        FROM heartbeat_logs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', created_at)
        ORDER BY hour ASC`
      );
      
      // 4. 未确认通知
      const unacked = await query(
        "SELECT * FROM agent_notifications WHERE acknowledged = FALSE ORDER BY created_at DESC LIMIT 20"
      );
      
      // 5. 最近50条心跳日志
      const recentLogs = await query(
        "SELECT id, health, issues_count, issues, actions, tasks_executed, check_duration_ms, created_at FROM heartbeat_logs ORDER BY created_at DESC LIMIT 50"
      );
      
      return NextResponse.json({
        lastBeat,
        stats24h,
        trend,
        unacked,
        recentLogs,
      });
    }
    
    if (type === 'acknowledge') {
      // 确认通知
      const notifId = request.nextUrl.searchParams.get('id');
      if (!notifId) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      await run(
        "UPDATE agent_notifications SET acknowledged = TRUE, updated_at = NOW() WHERE id = $1",
        [notifId]
      );
      return NextResponse.json({ ok: true });
    }
    
    if (type === 'acknowledge_all') {
      await run(
        "UPDATE agent_notifications SET acknowledged = TRUE, updated_at = NOW() WHERE acknowledged = FALSE"
      );
      return NextResponse.json({ ok: true });
    }
    
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
