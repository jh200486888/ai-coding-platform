import { NextRequest, NextResponse } from 'next/server';
import { getTelemetryStats, cleanupTelemetryEvents } from '@/lib/telemetry';

// GET /api/telemetry — 查询遥测统计
export async function GET(request: NextRequest) {
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
