import { NextRequest } from 'next/server';
import { getTelemetryStats, getRecentTelemetry } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'stats';
    const hours = parseInt(searchParams.get('hours') || '24');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (type === 'stats') {
      const stats = await getTelemetryStats(hours);
      return Response.json({ success: true, data: stats });
    } else if (type === 'recent') {
      const recent = await getRecentTelemetry(limit);
      return Response.json({ success: true, data: recent });
    }

    return Response.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    logger.error('Telemetry API error:', error);
    return Response.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
