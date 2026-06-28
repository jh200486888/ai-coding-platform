import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const projects = await listProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[Projects] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

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
