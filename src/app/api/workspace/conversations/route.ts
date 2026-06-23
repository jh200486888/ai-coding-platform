import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/workspace/conversations?project_id=xxx - List conversations for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const conversations = await prisma.workspaceConversation.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Failed to fetch workspace conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/workspace/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, title } = body;
    
    if (!project_id || !title) {
      return NextResponse.json({ error: 'project_id and title are required' }, { status: 400 });
    }

    const conversation = await prisma.workspaceConversation.create({
      data: {
        projectId: project_id,
        title,
      },
    });
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Failed to create workspace conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
