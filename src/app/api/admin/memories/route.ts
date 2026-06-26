import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';

interface UserMemory {
  id: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string;
  importance: number;
  keywords: string;
}

// GET /api/admin/memories - 获取记忆列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '20');
    const q = searchParams.get('q') || '';
    const offset = (page - 1) * size;

    let whereClause = '';
    let params: any[] = [];
    let paramIndex = 1;

    if (q) {
      whereClause = `WHERE content ILIKE $${paramIndex} OR category ILIKE $${paramIndex} OR tags ILIKE $${paramIndex} OR keywords ILIKE $${paramIndex}`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // 获取总数
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_memory ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0');

    // 获取分页数据
    params.push(size);
    params.push(offset);
    const memories = await query<UserMemory>(
      `SELECT id, category, content, "createdAt", "updatedAt", tags, importance, keywords 
       FROM user_memory 
       ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return NextResponse.json({ data: memories, total });
  } catch (error) {
    console.error('Failed to get memories:', error);
    return NextResponse.json({ success: false, error: '获取记忆失败' }, { status: 500 });
  }
}

// DELETE /api/admin/memories - 删除记忆
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ids } = body;

    let deleteIds: string[] = [];
    
    if (ids && Array.isArray(ids)) {
      deleteIds = ids;
    } else if (id) {
      deleteIds = [id];
    }

    if (deleteIds.length === 0) {
      return NextResponse.json({ success: false, error: '缺少删除目标' }, { status: 400 });
    }

    const placeholders = deleteIds.map((_, i) => `$${i + 1}`).join(',');
    await run(`DELETE FROM user_memory WHERE id IN (${placeholders})`, deleteIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete memories:', error);
    return NextResponse.json({ success: false, error: '删除记忆失败' }, { status: 500 });
  }
}
