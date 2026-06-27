import { NextRequest, NextResponse } from 'next/server';
import { listConversationsByUser, createConversationWithUser } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    // Pass userId (null for anonymous) so they can see their anonymous conversations
    const conversations = await listConversationsByUser(user?.id || null, user?.role);
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json({ error: '获取对话列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { id, title, modelId } = await request.json();
    const userId = user?.id || null;
    await createConversationWithUser(id, title || '新对话', modelId || null, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: '创建对话失败' }, { status: 500 });
  }
}
