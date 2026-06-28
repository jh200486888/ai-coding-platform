import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/workspace/files - 获取项目文件
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const files = await query(
      'SELECT id, "projectId", name, path, content, language, type, "parentId", "createdAt", "updatedAt" FROM workspace_files WHERE "projectId" = $1 ORDER BY path ASC',
      [projectId]
    );

    return NextResponse.json(files);
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

// POST /api/workspace/files - 创建/更新文件
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { projectId, path, content, name, language, type } = body;

    if (!projectId || !path) {
      return NextResponse.json({ error: 'Project ID and file path are required' }, { status: 400 });
    }

    // Check if file exists
    const existing = await queryOne(
      'SELECT id FROM workspace_files WHERE "projectId" = $1 AND path = $2',
      [projectId, path]
    );

    if (existing) {
      // Update
      await run(
        'UPDATE workspace_files SET content = $1, name = $2, language = $3, "updatedAt" = NOW() WHERE id = $4',
        [content || '', name || path.split('/').pop() || path, language || null, existing.id]
      );
      return NextResponse.json({ success: true, action: 'updated', id: existing.id });
    } else {
      // Create
      const { randomUUID } = await import('crypto');
      const id = randomUUID();
      await run(
        'INSERT INTO workspace_files (id, "projectId", name, path, content, language, type, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
        [id, projectId, name || path.split('/').pop() || path, path, content || '', language || null, type || 'file']
      );
      return NextResponse.json({ success: true, action: 'created', id });
    }
  } catch (error) {
    console.error('Failed to save file:', error);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}

// DELETE /api/workspace/files - 删除文件
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const path = searchParams.get('path');

    if (!projectId || !path) {
      return NextResponse.json({ error: 'Project ID and file path are required' }, { status: 400 });
    }

    await run(
      'DELETE FROM workspace_files WHERE "projectId" = $1 AND path = $2',
      [projectId, path]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
