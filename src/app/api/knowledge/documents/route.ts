import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { indexDocument, deleteDocument } from '@/lib/rag';
import { isAdminAuthenticated } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET — 列出知识库下的文档
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('doc_id');
    // 单文档预览：返回完整内容
    if (docId) {
      const doc = await queryOne(
        'SELECT id, kb_id, title, source_type, source_path, content, chunk_count, createdat, updatedat FROM kb_documents WHERE id = $1',
        [docId]
      );
      if (!doc) {
        return NextResponse.json({ success: false, error: '文档不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: doc });
    }
    const kbId = searchParams.get('kb_id');
    if (!kbId) {
      return NextResponse.json({ success: false, error: '缺少 kb_id 或 doc_id 参数' }, { status: 400 });
    }
    const docs = await query(
      'SELECT id, kb_id, title, source_type, source_path, chunk_count, createdat, updatedat FROM kb_documents WHERE kb_id = $1 ORDER BY createdat DESC',
      [kbId]
    );
    return NextResponse.json({ success: true, data: docs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '查询失败' }, { status: 500 });
  }
}

// POST — 上传文档（文本粘贴或 URL 抓取）
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const body = await req.json();
    const { kb_id, title, content, source_type, source_path } = body;

    if (!kb_id) {
      return NextResponse.json({ success: false, error: '缺少 kb_id' }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: '标题不能为空' }, { status: 400 });
    }

    // 检查知识库是否存在
    const kb = await queryOne('SELECT id FROM knowledge_bases WHERE id = $1', [kb_id]);
    if (!kb) {
      return NextResponse.json({ success: false, error: '知识库不存在' }, { status: 404 });
    }

    // 根据来源类型获取内容
    let docContent = content || '';
    const docSourceType = source_type || 'text';
    const docSourcePath = source_path || '';

    // URL 类型：抓取网页内容
    if (docSourceType === 'url' && docSourcePath && !docContent.trim()) {
      try {
        const fetchRes = await fetch(docSourcePath, { signal: AbortSignal.timeout(15000) });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          // 简单提取文本：去标签
          docContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim();
        } else {
          return NextResponse.json({ success: false, error: `URL 抓取失败 (${fetchRes.status})` }, { status: 400 });
        }
      } catch (fetchErr: any) {
        return NextResponse.json({ success: false, error: `URL 抓取失败: ${fetchErr?.message}` }, { status: 400 });
      }
    }

    if (!docContent.trim()) {
      return NextResponse.json({ success: false, error: '内容不能为空' }, { status: 400 });
    }

    // 创建文档记录（chunk_count=0 表示正在索引）
    const doc = await queryOne(
      `INSERT INTO kb_documents (kb_id, title, source_type, source_path, content, chunk_count, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
       RETURNING id, kb_id, title, source_type, source_path, chunk_count, createdat, updatedat`,
      [kb_id, title.trim(), docSourceType, docSourcePath, docContent]
    );

    // 后台异步执行分块和 embedding 生成
    const docId = doc!.id;
    indexDocument(kb_id, docId, docContent).then(chunkCount => {
      logger.info(`[RAG] 文档 ${docId} 索引完成: ${chunkCount} chunks`);
    }).catch(err => {
      console.error(`[RAG] 文档 ${docId} 索引失败:`, err?.message);
    });

    return NextResponse.json({ success: true, data: doc, message: '文档已创建，正在后台生成索引...' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '创建失败' }, { status: 500 });
  }
}

// DELETE — 删除文档
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id 参数' }, { status: 400 });
    }
    await deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '删除失败' }, { status: 500 });
  }
}


