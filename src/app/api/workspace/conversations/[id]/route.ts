import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/storage/database/mysql-client';

// GET /api/workspace/conversations/[id] - Get a conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const convRows = await query(
      'SELECT * FROM workspace_conversations WHERE id = ?',
      [id]
    );
    
    if (convRows.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const msgRows = await query(
      'SELECT * FROM workspace_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );

    return NextResponse.json({
      ...convRows[0],
      messages: msgRows.map((msg: any) => ({
        ...msg,
        attachments: msg.attachments ? JSON.parse(msg.attachments) : null
      }))
    });
  } catch (error) {
    console.error('Failed to fetch workspace conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// DELETE /api/workspace/conversations/[id] - Delete a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query('DELETE FROM workspace_messages WHERE conversation_id = ?', [id]);
    await query('DELETE FROM workspace_conversations WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
