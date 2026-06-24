import { NextRequest, NextResponse } from 'next/server';
import { listConversations, createConversation } from '@/lib/db';

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ data: conversations });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, model_id } = body as { title?: string; model_id?: string };
    const conv = await createConversation(title || 'New Chat', model_id || 'doubao-seed-1-8-251228');
    return NextResponse.json({ data: conv });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
