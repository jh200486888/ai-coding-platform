// RAG 核心逻辑 — 知识库向量检索
import { query, queryOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

// ============ Embedding 生成 ============

interface EmbeddingConfig {
  apiKey: string;
  baseUrl: string;
}

// P53: 多Provider embedding支持
const EMBEDDING_PROVIDERS: Record<string, { baseUrl: string; model: string }> = {
  'text-embedding-3-small': { baseUrl: 'openai', model: 'text-embedding-3-small' },
  'text-embedding-3-large': { baseUrl: 'openai', model: 'text-embedding-3-large' },
  'text-embedding-ada-002': { baseUrl: 'openai', model: 'text-embedding-ada-002' },
  'bge-m3': { baseUrl: 'openai', model: 'bge-m3' }, // via uiuiapi
  'embedding-3': { baseUrl: 'deepseek', model: 'embedding-3' },
};

async function getEmbeddingConfig(model: string = 'text-embedding-3-small'): Promise<EmbeddingConfig & { model: string }> {
  const providerInfo = EMBEDDING_PROVIDERS[model];
  const providerName = providerInfo?.baseUrl || 'openai';
  const actualModel = providerInfo?.model || model;
  
  const row = await queryOne<{ api_key_encrypted: string; base_url: string | null; is_active: number }>(
    'SELECT "apiKey" as api_key_encrypted, "baseUrl" as base_url, CASE WHEN "isActive" THEN 1 ELSE 0 END as is_active FROM api_keys WHERE provider = $1 AND "isActive" = true',
    [providerName]
  );
  if (!row || !row.api_key_encrypted) {
    // Fallback to openai provider
    if (providerName !== 'openai') {
      const fallbackRow = await queryOne<{ api_key_encrypted: string; base_url: string | null }>(
        'SELECT "apiKey" as api_key_encrypted, "baseUrl" as base_url FROM api_keys WHERE provider = \'openai\' AND "isActive" = true'
      );
      if (fallbackRow?.api_key_encrypted) {
        const apiKey = Buffer.from(fallbackRow.api_key_encrypted, 'base64').toString('utf-8');
        const baseUrl = (fallbackRow.base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
        return { apiKey, baseUrl, model: actualModel };
      }
    }
    throw new Error('未找到活跃的 API Key，请先在后台配置 openai 或 deepseek 的 API Key');
  }
  const apiKey = Buffer.from(row.api_key_encrypted, 'base64').toString('utf-8');
  const baseUrl = (row.base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
  return { apiKey, baseUrl, model: actualModel };
}

export async function generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
  const config = await getEmbeddingConfig(model);
  const url = `${config.baseUrl}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: text.slice(0, 8191), // OpenAI embedding token limit
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Embedding API 错误 (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error('Embedding API 返回格式异常');
  }
  return data.data[0].embedding;
}

// ============ 文本分块 ============

export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  if (!text || text.trim().length === 0) return [];

  // 先按段落分割，保留中文句子完整性
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    // 如果当前块 + 段落不超过 chunkSize，直接拼接
    if ((currentChunk + '\n' + para).trim().length <= chunkSize) {
      currentChunk = currentChunk ? currentChunk + '\n' + para : para;
    } else {
      // 当前块已满，保存
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // 如果段落本身超过 chunkSize，需要按句子切分
      if (para.length > chunkSize) {
        const subChunks = splitLongParagraph(para, chunkSize, overlap);
        currentChunk = subChunks.length > 0 ? subChunks.pop()! : '';
        chunks.push(...subChunks);
      } else {
        // 保留 overlap
        if (currentChunk && overlap > 0) {
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '\n' + para;
        } else {
          currentChunk = para;
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

function splitLongParagraph(para: string, chunkSize: number, overlap: number): string[] {
  // 按句子分割（中英文标点）
  const sentences = para.split(/(?<=[。！？.!?\n])/g).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length <= chunkSize) {
      current += sentence;
    } else {
      if (current.trim()) chunks.push(current.trim());
      // overlap
      if (current && overlap > 0) {
        const overlapText = current.slice(-overlap);
        current = overlapText + sentence;
      } else {
        current = sentence;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // 如果单句超过 chunkSize，强制切分
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize) {
      finalChunks.push(chunk);
    } else {
      for (let i = 0; i < chunk.length; i += chunkSize - overlap) {
        const sub = chunk.slice(i, i + chunkSize);
        if (sub.trim()) finalChunks.push(sub.trim());
      }
    }
  }

  return finalChunks;
}

// ============ 文档索引 ============

export async function indexDocument(kbId: string, docId: string, text: string, chunkSize?: number, overlap?: number): Promise<number> {
  // 获取知识库配置
  const kb = await queryOne<{ chunk_size: number; chunk_overlap: number; embedding_model: string }>(
    'SELECT chunk_size, chunk_overlap, embedding_model FROM knowledge_bases WHERE id = $1',
    [kbId]
  );
  if (!kb) throw new Error('知识库不存在');

  const effectiveChunkSize = chunkSize || kb.chunk_size || 500;
  const effectiveOverlap = overlap || kb.chunk_overlap || 50;
  const embeddingModel = kb.embedding_model || 'text-embedding-3-small';

  // 分块
  const chunks = chunkText(text, effectiveChunkSize, effectiveOverlap);
  if (chunks.length === 0) {
    await run('UPDATE kb_documents SET chunk_count = 0, updatedat = NOW() WHERE id = $1', [docId]);
    return 0;
  }

  // 逐块生成 embedding 并存入数据库
  let indexedCount = 0;
  let failedCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i], embeddingModel);
      const chunkId = randomUUID();
      const embeddingStr = `[${embedding.join(',')}]`;

      await run(
        `INSERT INTO kb_chunks (id, doc_id, kb_id, content, chunk_index, embedding, metadata, createdat)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7, NOW())`,
        [chunkId, docId, kbId, chunks[i], i, embeddingStr, JSON.stringify({ chunk_index: i, doc_id: docId })]
      );
      indexedCount++;
    } catch (err: any) {
      console.error(`[RAG] 生成 embedding 失败 (chunk ${i}):`, err?.message);
      failedCount++;
      // 仍然存储未生成 embedding 的 chunk（搜索时自动跳过）
      const chunkId = randomUUID();
      await run(
        `INSERT INTO kb_chunks (id, doc_id, kb_id, content, chunk_index, metadata, createdat)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [chunkId, docId, kbId, chunks[i], i, JSON.stringify({ chunk_index: i, doc_id: docId, embedding_failed: true })]
      );
      indexedCount++;
    }
  }

  // 更新文档的 chunk 数量
  await run('UPDATE kb_documents SET chunk_count = $1, updatedat = NOW() WHERE id = $2', [indexedCount, docId]);
  if (failedCount > 0) {
    console.warn(`[RAG] 文档 ${docId} 有 ${failedCount}/${chunks.length} 个分块 embedding 失败`);
  }
  return indexedCount;
}

// ============ 向量相似度搜索 ============

export interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  kb_id: string;
  doc_id: string;
}

// 相似度最低门槛，低于此值的结果不返回
const MIN_SIMILARITY = 0.3;

export async function searchKnowledge(queryText: string, kbIds: string[], topK: number = 5, minSimilarity: number = MIN_SIMILARITY): Promise<SearchResult[]> {
  if (!kbIds || kbIds.length === 0) return [];

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await query<SearchResult>(
      `SELECT content, metadata, 1 - (embedding <=> $1::vector) as similarity, kb_id, doc_id
       FROM kb_chunks
       WHERE kb_id = ANY($2) AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [embeddingStr, kbIds, topK]
    );

    // 过滤低相似度结果
    return results.filter(r => r.similarity >= minSimilarity);
  } catch (err: any) {
    console.error('[RAG] 向量搜索失败:', err?.message);
    return [];
  }
}

// ============ 获取活跃知识库 ID 列表 ============

export async function getActiveKnowledgeBaseIds(): Promise<string[]> {
  const rows = await query<{ id: string }>(
    'SELECT id FROM knowledge_bases WHERE is_active = true'
  );
  return rows.map(r => r.id);
}

// ============ 删除文档及其 chunks ============

export async function deleteDocument(docId: string): Promise<void> {
  // CASCADE 会自动删除关联的 kb_chunks
  await run('DELETE FROM kb_documents WHERE id = $1', [docId]);
}

// ============ 删除整个知识库 ============

export async function deleteKnowledgeBase(kbId: string): Promise<void> {
  // CASCADE 会自动删除关联的 kb_documents 和 kb_chunks
  await run('DELETE FROM knowledge_bases WHERE id = $1', [kbId]);
}

// ============ 获取知识库统计信息 ============

export async function getKnowledgeBaseStats(kbId: string): Promise<{ doc_count: number; chunk_count: number; failed_chunks: number }> {
  const docRow = await queryOne<{ doc_count: number }>('SELECT COUNT(*) as doc_count FROM kb_documents WHERE kb_id = $1', [kbId]);
  const chunkRow = await queryOne<{ chunk_count: number; failed_count: number }>(
    'SELECT COUNT(*) as chunk_count, COUNT(*) FILTER (WHERE embedding IS NULL) as failed_count FROM kb_chunks WHERE kb_id = $1', [kbId]
  );
  return {
    doc_count: docRow?.doc_count || 0,
    chunk_count: chunkRow?.chunk_count || 0,
    failed_chunks: chunkRow?.failed_count || 0,
  };
}

