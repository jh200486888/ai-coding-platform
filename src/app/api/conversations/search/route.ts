import { NextRequest, NextResponse } from 'next/server';
import { searchConversationsAndMessages } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const results = await searchConversationsAndMessages(query.trim(), user.id, limit);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
