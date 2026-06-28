import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workspace/models - 获取已启用的模型列表（供前端选择器使用）
export async function GET() {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const models = await query(
      `SELECT 
        "modelId" as model_id, 
        name as display_name, 
        provider, 
        description
      FROM model_configs 
      WHERE "isActive" = true 
      ORDER BY "sortOrder" ASC NULLS LAST`
    );
    
    return NextResponse.json(models);
  } catch (error) {
    console.error('[WorkspaceModels] GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
