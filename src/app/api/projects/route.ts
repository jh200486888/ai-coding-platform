import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'ai_platform',
  password: process.env.DB_PASSWORD || 'AiPlatform2026!',
  database: process.env.DB_NAME || 'ai_platform',
  max: 5,
});

// GET /api/projects
export async function GET() {
  try {
    const result = await pool.query(
      'SELECT p.id, p.name, p.description, p.tech_stack, p."createdAt", p."updatedAt", ' +
      '(SELECT COUNT(*) FROM workspace_files f WHERE f."projectId" = p.id)::int as file_count, ' +
      '(SELECT COUNT(*) FROM workspace_conversations c WHERE c."projectId" = p.id)::int as conv_count ' +
      'FROM projects p ORDER BY p."updatedAt" DESC'
    );
    const projects = result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      tech_stack: r.tech_stack || '[]',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      _count: { files: r.file_count || 0, conversations: r.conv_count || 0 },
    }));
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[Projects] GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/projects
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, techStack } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const id = randomUUID();

    // Convert techStack string to JSON array
    let techStackJson = '[]';
    if (techStack && typeof techStack === 'string') {
      const techs = techStack.split(',').map((s: string) => s.trim()).filter(Boolean);
      techStackJson = JSON.stringify(techs);
    }

    await pool.query(
      'INSERT INTO projects (id, name, description, tech_stack, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())',
      [id, name, description || '', techStackJson]
    );

    const fileId = randomUUID();
    await pool.query(
      'INSERT INTO workspace_files (id, "projectId", name, path, content, type, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
      [fileId, id, 'README.md', 'README.md', '# ' + name + '\n\n' + (description || 'New project'), 'file']
    );

    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('[Projects] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create project', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/projects
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await pool.query('DELETE FROM workspace_messages WHERE "conversationId" IN (SELECT id FROM workspace_conversations WHERE "projectId" = $1)', [id]);
    await pool.query('DELETE FROM workspace_conversations WHERE "projectId" = $1', [id]);
    await pool.query('DELETE FROM workspace_files WHERE "projectId" = $1', [id]);
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Projects] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
