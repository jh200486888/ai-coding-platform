import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaceConversations, createWorkspaceConversation } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    const conversations = await listWorkspaceConversations(projectId);
    return NextResponse.json(conversations);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, title } = body;
    if (!project_id || !title) return NextResponse.json({ error: 'project_id and title are required' }, { status: 400 });
    const conversation = await createWorkspaceConversation(project_id, title);
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
