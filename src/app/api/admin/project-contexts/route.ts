import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { listProjectContexts, upsertProjectContext, updateProjectContext, deleteProjectContext } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectKey = req.nextUrl.searchParams.get('project_key') || 'default';
  const contexts = await listProjectContexts(projectKey);
  return NextResponse.json(contexts);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { action } = body;

  if (action === 'create') {
    await upsertProjectContext({ project_key: body.project_key || 'default', context_type: body.context_type || 'system_prompt', title: body.title || '', content: body.content || '', sort_order: body.sort_order || 0, is_active: body.is_active !== false });
    return NextResponse.json({ success: true });
  }
  if (action === 'update') {
    await updateProjectContext(body.id, { title: body.title, content: body.content, sort_order: body.sort_order, is_active: body.is_active, context_type: body.context_type });
    return NextResponse.json({ success: true });
  }
  if (action === 'delete') { await deleteProjectContext(body.id); return NextResponse.json({ success: true }); }
  if (action === 'toggle') { await updateProjectContext(body.id, { is_active: body.is_active }); return NextResponse.json({ success: true }); }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
