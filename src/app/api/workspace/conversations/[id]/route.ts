import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceConversationWithMessages, deleteWorkspaceConversation } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const conversation = await getWorkspaceConversationWithMessages(id);
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(conversation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteWorkspaceConversation(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
