import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaceConversations, createWorkspaceConversation } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: '缺少 project_id' }, { status: 400 });
    }

    const conversations = await listWorkspaceConversations(projectId);
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('List workspace conversations error:', error);
    return NextResponse.json({ error: '获取对话列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { projectId, title } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
    }

    const conversation = await createWorkspaceConversation(projectId, title || '新对话');
    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Create workspace conversation error:', error);
    return NextResponse.json({ error: '创建对话失败' }, { status: 500 });
  }
}
