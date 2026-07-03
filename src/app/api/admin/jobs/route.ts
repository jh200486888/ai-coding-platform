import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { enqueueJob, listJobs, getJob, cancelJob } from '@/lib/job-queue';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const job = await getJob(id);
    return NextResponse.json(job || { error: 'Not found' });
  }
  const jobs = await listJobs(limit, status);
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  
  if (body.action === 'enqueue') {
    const id = await enqueueJob(body.job_type || 'chat_task', body.title || 'Background task', body.payload || {}, body.priority || 0);
    return NextResponse.json({ success: true, id });
  }
  
  if (body.action === 'cancel') {
    await cancelJob(body.id);
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
