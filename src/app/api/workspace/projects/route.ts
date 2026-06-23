import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/storage/database/mysql-client';
import { v4 as uuidv4 } from 'uuid';

// GET /api/workspace/projects - List all projects
export async function GET() {
  try {
    const rows = await query(
      'SELECT * FROM workspace_projects ORDER BY updated_at DESC'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch workspace projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/workspace/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO workspace_projects (id, name, description) VALUES (?, ?, ?)',
      [id, name, description || null]
    );

    const rows = await query('SELECT * FROM workspace_projects WHERE id = ?', [id]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create workspace project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
