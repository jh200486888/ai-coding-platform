import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';

// GET /api/workspace/messages?conversationId=xxx - Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const messages = await query(
      'SELECT id, "conversationId", role, content, "modelId", "createdAt" FROM workspace_messages WHERE "conversationId" = $1 ORDER BY "createdAt" ASC',
      [conversationId]
    );

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch workspace messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
