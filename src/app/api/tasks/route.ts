// @ts-nocheck
/**
 * Scheduled Tasks API - 定时任务管理
 * 适配新的scheduled_tasks表结构
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { query, queryOne, run } from '@/lib/db';

// GET - list all scheduled tasks
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  return handleGet(request);
}

async function handleGet() {
  try {
    const rows = await query('SELECT id, conversation_id, task_name, task_description, cron_expression, next_run_at, last_run_at, status, run_count, max_runs, result_summary, created_at, updated_at FROM scheduled_tasks ORDER BY created_at DESC');
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - create or update a task
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  return handlePost(request);
}

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, task_name, task_description, cron_expression, status, max_runs, conversation_id } = body;

    if (id) {
      // Update existing task
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      
      if (task_name !== undefined) { updates.push(`task_name = $${idx++}`); values.push(task_name); }
      if (task_description !== undefined) { updates.push(`task_description = $${idx++}`); values.push(task_description); }
      if (cron_expression !== undefined) { updates.push(`cron_expression = $${idx++}`); values.push(cron_expression); }
      if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
      if (max_runs !== undefined) { updates.push(`max_runs = $${idx++}`); values.push(max_runs); }
      
      if (updates.length === 0) {
        return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(id);
      
      await run(
        `UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
      return NextResponse.json({ success: true, id });
    }

    // Create new task
    if (!task_name || !task_description || !cron_expression) {
      return NextResponse.json({ error: '任务名称、描述和Cron表达式不能为空' }, { status: 400 });
    }

    const taskId = 'cron_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const nextRun = computeNextRun(cron_expression);

    await run(
      `INSERT INTO scheduled_tasks (id, conversation_id, task_name, task_description, cron_expression, next_run_at, status, run_count, max_runs, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, NOW(), NOW())`,
      [taskId, conversation_id || null, task_name, task_description, cron_expression, nextRun?.toISOString(), status || 'active', max_runs || null]
    );

    return NextResponse.json({ data: { id: taskId, task_name, cron_expression, next_run_at: nextRun } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - toggle task status (pause/resume)
export async function PATCH(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (!id || !action) return NextResponse.json({ error: '缺少id或action' }, { status: 400 });

    if (action === 'pause') {
      await run('UPDATE scheduled_tasks SET status = $1, updated_at = NOW() WHERE id = $2', ['paused', id]);
    } else if (action === 'resume') {
      // Recalculate next_run_at when resuming
      const task = await queryOne('SELECT cron_expression FROM scheduled_tasks WHERE id = $1', [id]);
      const nextRun = task ? computeNextRun(task.cron_expression) : null;
      await run('UPDATE scheduled_tasks SET status = $1, next_run_at = $2, updated_at = NOW() WHERE id = $3', ['active', nextRun?.toISOString(), id]);
    } else if (action === 'trigger') {
      // Manual trigger - mark for immediate execution
      await run('UPDATE scheduled_tasks SET next_run_at = NOW(), status = $1, updated_at = NOW() WHERE id = $2', ['active', id]);
    } else {
      return NextResponse.json({ error: '无效action，支持: pause/resume/trigger' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - delete a task
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  return handleDelete(request);
}

async function handleDelete(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    await run('DELETE FROM scheduled_tasks WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 简易Cron解析（与agent-state.ts保持一致）
function computeNextRun(cronExpression: string): Date | null {
  const now = new Date();
  if (cronExpression.startsWith('every_N_minutes:')) {
    const mins = parseInt(cronExpression.split(':')[1]) || 30;
    return new Date(now.getTime() + mins * 60000);
  }
  if (cronExpression.startsWith('every_N_hours:')) {
    const hours = parseInt(cronExpression.split(':')[1]) || 1;
    return new Date(now.getTime() + hours * 3600000);
  }
  if (cronExpression.startsWith('daily:')) {
    const [_, time] = cronExpression.split(':');
    const [h, m] = (time || '09:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(h || 0, m || 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (cronExpression.startsWith('weekly:')) {
    const parts = cronExpression.split(':');
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = dayMap[(parts[1] || 'mon').toLowerCase()] ?? 1;
    const [h, m] = (parts[2] || '10:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(h || 0, m || 0, 0, 0);
    const currentDay = next.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0 || (daysAhead === 0 && next <= now)) daysAhead += 7;
    next.setDate(next.getDate() + daysAhead);
    return next;
  }
  return new Date(now.getTime() + 3600000);
}
