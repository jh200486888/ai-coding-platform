import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceFile, updateWorkspaceFile, deleteWorkspaceFile } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }
  try {
    const { id } = await params;
    const file = await getWorkspaceFile(id);
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }
  try {
    const { id } = await params;
    const body = await request.json();
    const file = await updateWorkspaceFile(id, { name: body.name, content: body.content, path: body.path });
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }
  try {
    const { id } = await params;
    await deleteWorkspaceFile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
