import { getCurrentUser, isAdminAuthenticated } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';

// GET - list all scheduled tasks
export async function GET() {
  const user = await getCurrentUser(); const isAdmin = await isAdminAuthenticated(); if (!user && !isAdmin) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const rows = await query('SELECT * FROM scheduled_tasks ORDER BY \"createdAt\" DESC');
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - create a new scheduled task
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(); const isAdmin = await isAdminAuthenticated(); if (!user && !isAdmin) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const { title, prompt, runIn } = await request.json() as {
      title: string;
      prompt: string;
      runIn?: string; // e.g. "30m", "1h", "2h", "tomorrow"
    };

    if (!title || !prompt) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 });
    }

    // Calculate next run time
    let nextRunAt: Date | null = null;
    if (runIn) {
      const now = new Date();
      const match = runIn.match(/^(\d+)(m|h|d)$/);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2];
        if (unit === 'm') nextRunAt = new Date(now.getTime() + num * 60000);
        else if (unit === 'h') nextRunAt = new Date(now.getTime() + num * 3600000);
        else if (unit === 'd') nextRunAt = new Date(now.getTime() + num * 86400000);
      }
    }

    const id = 'task_' + Date.now();
    await run(
      'INSERT INTO scheduled_tasks (id, title, prompt, \"nextRunAt\", \"isActive\", \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, true, NOW(), NOW())',
      [id, title, prompt, nextRunAt]
    );

    return NextResponse.json({ data: { id, title, prompt, nextRunAt } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - delete a task
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(); const isAdmin = await isAdminAuthenticated(); if (!user && !isAdmin) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

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


// PATCH - toggle task active status
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(); const isAdmin = await isAdminAuthenticated(); if (!user && !isAdmin) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const { id, isActive } = await request.json() as { id: string; isActive: boolean };
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    await run(
      'UPDATE scheduled_tasks SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2',
      [isActive, id]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
