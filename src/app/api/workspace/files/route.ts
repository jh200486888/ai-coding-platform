import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/workspace/files - 获取项目文件
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const files = await prisma.workspaceFile.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}

// POST /api/workspace/files - 创建/更新文件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, path, content, name, language } = body;

    if (!projectId || !path) {
      return NextResponse.json(
        { error: 'Project ID and file path are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 使用 upsert 创建或更新文件
    const file = await prisma.workspaceFile.upsert({
      where: {
        projectId_path: { projectId, path },
      },
      update: {
        content: content || '',
        name: name || path.split('/').pop() || path,
        language: language || null,
      },
      create: {
        projectId,
        path,
        name: name || path.split('/').pop() || path,
        content: content || '',
        language: language || null,
      },
    });

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('Failed to save file:', error);
    return NextResponse.json(
      { error: 'Failed to save file' },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/files - 删除文件
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const path = searchParams.get('path');

    if (!projectId || !path) {
      return NextResponse.json(
        { error: 'Project ID and file path are required' },
        { status: 400 }
      );
    }

    await prisma.workspaceFile.deleteMany({
      where: { projectId, path },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
