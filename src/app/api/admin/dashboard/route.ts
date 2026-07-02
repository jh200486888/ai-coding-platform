import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    // 1. Total conversations count
    const convCount = await queryOne('SELECT COUNT(*) as count FROM conversations');
    
    // 2. Today messages count
    const todayMsg = await queryOne('SELECT COUNT(*) as count FROM chat_messages WHERE "createdAt" >= CURRENT_DATE');
    
    // 2b. Today conversations count
    const todayConv = await queryOne('SELECT COUNT(*) as count FROM conversations WHERE "createdAt" >= CURRENT_DATE');
    
    // 3. Active models count (distinct providers with API keys)
    const activeModels = await queryOne('SELECT COUNT(DISTINCT provider) as count FROM api_keys WHERE "isActive" = true');
    
    // 4. Recent 10 conversations (ordered by last activity, with message count)
    const recentConvs = await query(
      `SELECT c.id, c.title, c."modelId", c."userId", c."createdAt", c."updatedAt",
        (SELECT COUNT(*) FROM chat_messages WHERE "conversationId" = c.id)::int as msg_count
       FROM conversations c ORDER BY c."updatedAt" DESC LIMIT 10`
    );
    
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
    
    // 8. Token usage stats
    let todayTokens = { prompt: 0, completion: 0, total: 0 };
    let totalTokens = { prompt: 0, completion: 0, total: 0 };
    try {
      const todayTokenStats = await queryOne(
        'SELECT COALESCE(SUM(prompt_tokens),0) as prompt, COALESCE(SUM(completion_tokens),0) as completion, COALESCE(SUM(total_tokens),0) as total FROM ai_telemetry WHERE created_at >= CURRENT_DATE'
      );
      if (todayTokenStats) {
        todayTokens = { prompt: parseInt(todayTokenStats.prompt), completion: parseInt(todayTokenStats.completion), total: parseInt(todayTokenStats.total) };
      }
      const totalTokenStats = await queryOne(
        'SELECT COALESCE(SUM(prompt_tokens),0) as prompt, COALESCE(SUM(completion_tokens),0) as completion, COALESCE(SUM(total_tokens),0) as total FROM ai_telemetry'
      );
      if (totalTokenStats) {
        totalTokens = { prompt: parseInt(totalTokenStats.prompt), completion: parseInt(totalTokenStats.completion), total: parseInt(totalTokenStats.total) };
      }
    } catch {}
    
    return NextResponse.json({
      success: true,
      data: {
        totalConversations: parseInt(convCount?.count) || 0,
        todayConversations: parseInt(todayConv?.count) || 0,
        todayMessages: parseInt(todayMsg?.count) || 0,
        activeModels: parseInt(activeModels?.count) || 0,
        apiSuccessRate: successRate,
        recentConversations: recentConvs || [],
        dbHealthy,
        activeApiKeys: parseInt(keyCount?.count) || 0,
        todayTokens,
        totalTokens,
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
