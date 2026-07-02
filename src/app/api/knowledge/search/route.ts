import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge, getActiveKnowledgeBaseIds } from '@/lib/rag';
import { isAdminAuthenticated } from '@/lib/auth';

// POST — 搜索知识库
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const body = await req.json();
    const { query: queryText, kb_ids, top_k, min_similarity } = body;

    if (!queryText || !queryText.trim()) {
      return NextResponse.json({ success: false, error: '查询内容不能为空' }, { status: 400 });
    }

    if (queryText.trim().length < 2) {
      return NextResponse.json({ success: true, data: [], message: '查询内容过短' });
    }

    // 如果未指定 kb_ids，搜索所有活跃知识库
    let effectiveKbIds = kb_ids;
    if (!effectiveKbIds || effectiveKbIds.length === 0) {
      effectiveKbIds = await getActiveKnowledgeBaseIds();
    }

    if (effectiveKbIds.length === 0) {
      return NextResponse.json({ success: true, data: [], message: '没有活跃的知识库' });
    }

    const results = await searchKnowledge(queryText, effectiveKbIds, top_k || 5, min_similarity || 0.3);
    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '搜索失败' }, { status: 500 });
  }
}

