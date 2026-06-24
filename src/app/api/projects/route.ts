import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/projects - 获取所有项目
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { conversations: true, files: true },
        },
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('[Projects] Failed to fetch projects:', error);
    console.error('[Projects] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, modelId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || '',
      },
    });

    // 创建默认的 README.md 文件
    await prisma.workspaceFile.create({
      data: {
        projectId: project.id,
        name: 'README.md',
        path: 'README.md',
        content: `# ${name}\n\n${description || 'New project'}`,
        type: 'file',
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('[Projects] Failed to create project:', error);
    console.error('[Projects] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { error: 'Failed to create project', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/projects - 删除项目
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 先删除相关的 workspace conversations（会级联删除 messages）
    await prisma.workspaceConversation.deleteMany({
      where: { projectId: id },
    });

    // 删除项目
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects - 更新项目
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, modelId, files } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (modelId !== undefined) updateData.modelId = modelId;
    if (files !== undefined) updateData.files = files;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}
