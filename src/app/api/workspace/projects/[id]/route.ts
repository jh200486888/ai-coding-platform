import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/storage/database/mysql-client';

// GET /api/workspace/projects/[id] - Get a single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await query(
      'SELECT * FROM workspace_projects WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch workspace project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PATCH /api/workspace/projects/[id] - Update a project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;
    
    await query(
      'UPDATE workspace_projects SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = NOW() WHERE id = ?',
      [name, description, id]
    );

    const rows = await query('SELECT * FROM workspace_projects WHERE id = ?', [id]);
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to update workspace project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/workspace/projects/[id] - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete all files in the project
    await query('DELETE FROM workspace_files WHERE project_id = ?', [id]);
    
    // Delete all conversations in the project
    const conversations = await query('SELECT id FROM workspace_conversations WHERE project_id = ?', [id]);
    for (const conv of conversations) {
      await query('DELETE FROM workspace_messages WHERE conversation_id = ?', [conv.id]);
    }
    await query('DELETE FROM workspace_conversations WHERE project_id = ?', [id]);
    
    // Delete the project
    await query('DELETE FROM workspace_projects WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
