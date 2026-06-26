import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/db';

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[Projects] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const project = await createProject(name, description);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('[Projects] Failed:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
