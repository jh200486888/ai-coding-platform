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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { files: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project.files);
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
    const { projectId, path, content } = body;

    if (!projectId || !path) {
      return NextResponse.json(
        { error: 'Project ID and file path are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { files: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 更新文件
    const files = { ...(project.files as Record<string, string>) };
    files[path] = content || '';

    await prisma.project.update({
      where: { id: projectId },
      data: { files },
    });

    return NextResponse.json({ success: true, files });
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { files: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 删除文件
    const files = { ...(project.files as Record<string, string>) };
    delete files[path];

    await prisma.project.update({
      where: { id: projectId },
      data: { files },
    });

    return NextResponse.json({ success: true, files });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspace/files - 重命名文件
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, oldPath, newPath } = body;

    if (!projectId || !oldPath || !newPath) {
      return NextResponse.json(
        { error: 'Project ID, old path and new path are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { files: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 重命名文件
    const files = { ...(project.files as Record<string, string>) };
    if (files[oldPath] === undefined) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    files[newPath] = files[oldPath];
    delete files[oldPath];

    await prisma.project.update({
      where: { id: projectId },
      data: { files },
    });

    return NextResponse.json({ success: true, files });
  } catch (error) {
    console.error('Failed to rename file:', error);
    return NextResponse.json(
      { error: 'Failed to rename file' },
      { status: 500 }
    );
  }
}
