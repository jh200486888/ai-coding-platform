import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    // 1. Total conversations count
    const convCount = await queryOne('SELECT COUNT(*) as count FROM conversations');
    
    // 2. Today messages count
    const todayMsg = await queryOne('SELECT COUNT(*) as count FROM chat_messages WHERE "createdAt" >= CURRENT_DATE');
    
    // 3. Active models count (distinct providers with API keys)
    const activeModels = await queryOne('SELECT COUNT(DISTINCT provider) as count FROM api_keys WHERE "isActive" = true');
    
    // 4. Recent 5 conversations
    const recentConvs = await query('SELECT id, title, "modelId", "createdAt" FROM conversations ORDER BY "createdAt" DESC LIMIT 5');
    
    // 5. Telemetry stats for success rate (last 24h)
    let successRate = 100;
    try {
      const teStats = await queryOne(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
        FROM telemetry_events 
        WHERE created_at >= NOW() - INTERVAL '24 hours'`
      );
      if (teStats && teStats.total > 0) {
        successRate = Math.round(((teStats.total - (teStats.errors || 0)) / teStats.total) * 100);
      }
    } catch {}
    
    // 6. DB health check
    let dbHealthy = false;
    try {
      await queryOne('SELECT 1 as ok');
      dbHealthy = true;
    } catch {}
    
    // 7. API key count
    const keyCount = await queryOne('SELECT COUNT(*) as count FROM api_keys WHERE "isActive" = true');
    
    return NextResponse.json({
      success: true,
      data: {
        totalConversations: parseInt(convCount?.count) || 0,
        todayMessages: parseInt(todayMsg?.count) || 0,
        activeModels: parseInt(activeModels?.count) || 0,
        apiSuccessRate: successRate,
        recentConversations: recentConvs || [],
        dbHealthy,
        activeApiKeys: parseInt(keyCount?.count) || 0,
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
