import { isAdminAuthenticated } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getTelemetryStats, cleanupTelemetryEvents } from '@/lib/telemetry';

// GET /api/telemetry — 查询遥测统计
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // 限制范围：1-720 小时（30天）
    const validHours = Math.max(1, Math.min(720, hours));

    const stats = await getTelemetryStats(validHours);
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch telemetry stats' },
      { status: 500 }
    );
  }
}

// DELETE /api/telemetry — 清理过期遥测数据
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const validDays = Math.max(1, Math.min(365, days));

    const deleted = await cleanupTelemetryEvents(validDays);
    return NextResponse.json({ deleted, daysOld: validDays });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to cleanup telemetry' },
      { status: 500 }
    );
  }
}

// POST /api/telemetry — receive frontend error reports
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, stack, url, timestamp } = body;
    console.error('[FRONTEND-ERROR]', type || 'unknown', '|', message || 'no message');
    if (stack) console.error('[FRONTEND-STACK]', stack.substring(0, 500));
    if (url) console.error('[FRONTEND-URL]', url);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
