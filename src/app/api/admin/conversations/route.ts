import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Admin sees ALL conversations with message count, ordered by last activity
    const conversations = await query(
      `SELECT c.id, c.title, c."modelId", c."userId", c."createdAt", c."updatedAt",
        (SELECT COUNT(*) FROM chat_messages WHERE "conversationId" = c.id)::int as msg_count
       FROM conversations c ORDER BY c."updatedAt" DESC LIMIT 200`
    );
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Admin list conversations error:', error);
    return NextResponse.json({ error: '获取对话列表失败' }, { status: 500 });
  }
}

