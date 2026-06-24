import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/workspace/projects - List all projects
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[Workspace Projects] Failed to fetch projects:', error);
    console.error('[Workspace Projects] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({ error: 'Failed to fetch projects', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
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

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('[Workspace Projects] Failed to create project:', error);
    console.error('[Workspace Projects] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({ error: 'Failed to create project', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
