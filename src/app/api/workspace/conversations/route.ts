import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/storage/database/mysql-client';
import { v4 as uuidv4 } from 'uuid';

// GET /api/workspace/conversations?project_id=xxx - List conversations for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const rows = await query(
      'SELECT * FROM workspace_conversations WHERE project_id = ? ORDER BY updated_at DESC',
      [projectId]
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch workspace conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/workspace/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, title, model_id } = body;
    
    if (!project_id || !title) {
      return NextResponse.json({ error: 'project_id and title are required' }, { status: 400 });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO workspace_conversations (id, project_id, title, model_id) VALUES (?, ?, ?, ?)',
      [id, project_id, title, model_id || null]
    );

    const rows = await query('SELECT * FROM workspace_conversations WHERE id = ?', [id]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create workspace conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
