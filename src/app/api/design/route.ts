import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';

// GET - List design projects
export async function GET() {
  try {
    const projects = await query(
      `SELECT id, title, type, thumbnail, "updatedAt" FROM design_projects ORDER BY "updatedAt" DESC LIMIT 20`
    );
    return NextResponse.json({ data: projects || [] });
  } catch (e: any) {
    // Table might not exist yet
    if (e.message?.includes('does not exist')) {
      // Create the table
      await run(`CREATE TABLE IF NOT EXISTS design_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT DEFAULT 'poster',
        prompt TEXT,
        thumbnail TEXT,
        canvas_data TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`);
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ data: [] });
  }
}

// POST - Create design project
export async function POST(req: NextRequest) {
  try {
    const { title, prompt, type = 'poster' } = await req.json();
    const id = `design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      await run(
        `INSERT INTO design_projects (id, title, type, prompt, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [id, title || '未命名设计', type, prompt || '']
      );
    } catch (e: any) {
      // Create table if not exists
      if (e.message?.includes('does not exist')) {
        await run(`CREATE TABLE IF NOT EXISTS design_projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          type TEXT DEFAULT 'poster',
          prompt TEXT,
          thumbnail TEXT,
          canvas_data TEXT,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )`);
        await run(
          `INSERT INTO design_projects (id, title, type, prompt, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [id, title || '未命名设计', type, prompt || '']
        );
      } else {
        throw e;
      }
    }

    return NextResponse.json({ data: { id, title, type, prompt } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
