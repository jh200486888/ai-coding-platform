import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/storage/database/mysql-client';

// GET /api/workspace/files/[id] - Get a single file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await query(
      'SELECT * FROM workspace_files WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch workspace file:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

// PATCH /api/workspace/files/[id] - Update a file
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, content, path } = body;
    
    await query(
      'UPDATE workspace_files SET name = COALESCE(?, name), content = COALESCE(?, content), path = COALESCE(?, path) WHERE id = ?',
      [name, content, path, id]
    );

    const rows = await query('SELECT * FROM workspace_files WHERE id = ?', [id]);
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to update workspace file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

// DELETE /api/workspace/files/[id] - Delete a file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query('DELETE FROM workspace_files WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
