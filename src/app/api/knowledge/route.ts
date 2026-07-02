import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { deleteKnowledgeBase } from '@/lib/rag';
import { isAdminAuthenticated } from '@/lib/auth';

// GET — 列出所有知识库
export async function GET() {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const kbs = await query(
      `SELECT kb.id, kb.name, kb.description, kb.embedding_model, kb.chunk_size, kb.chunk_overlap,
              kb.is_active, kb.createdat, kb.updatedat,
              COALESCE(doc_stats.doc_count, 0) as doc_count,
              COALESCE(doc_stats.chunk_count, 0) as total_chunks
       FROM knowledge_bases kb
       LEFT JOIN (
         SELECT kb_id, COUNT(*) as doc_count, SUM(chunk_count) as chunk_count
         FROM kb_documents GROUP BY kb_id
       ) doc_stats ON doc_stats.kb_id = kb.id
       ORDER BY kb.createdat DESC`
    );
    return NextResponse.json({ success: true, data: kbs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '查询失败' }, { status: 500 });
  }
}

// POST — 创建知识库
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const body = await req.json();
    const { name, description, embedding_model, chunk_size, chunk_overlap } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: '名称不能为空' }, { status: 400 });
    }
    const kb = await queryOne(
      `INSERT INTO knowledge_bases (name, description, embedding_model, chunk_size, chunk_overlap, is_active, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, name, description, embedding_model, chunk_size, chunk_overlap, is_active, createdat, updatedat`,
      [name.trim(), description || '', embedding_model || 'text-embedding-3-small', chunk_size || 500, chunk_overlap || 50]
    );
    return NextResponse.json({ success: true, data: kb });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '创建失败' }, { status: 500 });
  }
}

// PUT — 更新知识库
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const body = await req.json();
    const { id, name, description, embedding_model, chunk_size, chunk_overlap, is_active } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 });
    }
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name.trim()); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description); }
    if (embedding_model !== undefined) { sets.push(`embedding_model = $${idx++}`); params.push(embedding_model); }
    if (chunk_size !== undefined) { sets.push(`chunk_size = $${idx++}`); params.push(chunk_size); }
    if (chunk_overlap !== undefined) { sets.push(`chunk_overlap = $${idx++}`); params.push(chunk_overlap); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(is_active); }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: '没有更新字段' }, { status: 400 });
    }

    sets.push(`updatedat = NOW()`);
    params.push(id);

    await run(
      `UPDATE knowledge_bases SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );
    const updated = await queryOne(
      'SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, is_active, createdat, updatedat FROM knowledge_bases WHERE id = $1',
      [id]
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '更新失败' }, { status: 500 });
  }
}

// DELETE — 删除知识库
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id 参数' }, { status: 400 });
    }
    await deleteKnowledgeBase(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '删除失败' }, { status: 500 });
  }
}

