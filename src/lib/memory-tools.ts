// @ts-nocheck // AI SDK v7 tool() type inference limitations
import { z } from 'zod';
import { tool } from 'ai';
import { query, queryOne, run } from '@/lib/db';

// ============ Embedding配置 ============

const EMBEDDING_MODEL = 'text-embedding-3-small';

async function getEmbeddingApiKey() {
  const row = await queryOne('SELECT "apiKey", "baseUrl" FROM api_keys WHERE provider = $1', ['openai']);
  if (!row) return null;
  return { key: Buffer.from(row.apiKey, 'base64').toString('utf-8'), baseUrl: row.baseUrl };
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!text || typeof text !== 'string') return null;
    const config = await getEmbeddingApiKey();
    if (!config) return null;
    const resp = await fetch((config.baseUrl || 'https://api1.uiuiapi.com/v1') + '/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.key },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.substring(0, 8000) })
    });
    const data = await resp.json();
    if (data.error) { console.error('[Memory] Embedding error:', data.error.message); return null; }
    if (!data.data || !data.data[0] || !data.data[0].embedding) { console.error('[Memory] Embedding: no data returned'); return null; }
    return data.data[0].embedding;
  } catch (e: any) {
    console.error('[Memory] Embedding failed:', e?.message);
    return null;
  }
}

// ============ 三层记忆架构 ============
// short_term: 当前对话状态，expires_at自动过期（默认1小时）
// mid_term: 近期索引，LRU淘汰（7天未访问降级）
// long_term: 长期语义记忆，embedding语义召回

const TIER_EXPIRY: Record<string, string> = {
  short_term: "1 hour",
  mid_term: "7 days",
  long_term: "never",
};

function inferTier(importance: number, category: string): string {
  if (category === 'conversation_state') return 'short_term';
  if (category === 'recent_context') return 'mid_term';
  if (importance >= 4) return 'long_term';
  return 'mid_term';
}

// ============ 语义搜索 ============

export async function searchMemories(keyword: string, category?: string, limit: number = 10): Promise<any[]> {
  // 1. 先尝试语义搜索（如果有keyword且embedding可用）
  if (keyword.trim()) {
    const embedding = await generateEmbedding(keyword);
    if (embedding && embedding.length > 0) {
      try {
        let sql = `
          SELECT id, category, content, tags, importance, memory_tier, "createdAt",
                 1 - (embedding <=> $1) as similarity
          FROM user_memory
          WHERE embedding IS NOT NULL
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        const params: any[] = [`[${embedding.join(',')}]`];
        let paramIdx = 2;
        
        if (category) {
          sql += ` AND category = $${paramIdx}`;
          params.push(category);
          paramIdx++;
        }
        
        sql += ` ORDER BY embedding <=> $1 LIMIT $${paramIdx}`;
        params.push(limit);
        
        const semanticResults = await query(sql, params);
        
        // 如果语义搜索有结果，更新last_accessed_at并返回
        if (semanticResults && semanticResults.length > 0) {
          // 更新访问时间（中期记忆LRU）
          const ids = semanticResults.map((r: any) => r.id);
          await run(`UPDATE user_memory SET last_accessed_at = NOW() WHERE id = ANY($1)`, [ids]).catch(() => {});
          return semanticResults;
        }
      } catch (e: any) {
        console.error('[Memory] Semantic search failed, fallback to keyword:', e?.message);
      }
    }
    
    // 2. Fallback到关键词搜索
    let sql = `SELECT id, category, content, tags, importance, memory_tier, "createdAt" FROM user_memory WHERE (content ILIKE $1 OR category ILIKE $1 OR tags ILIKE $1) AND (expires_at IS NULL OR expires_at > NOW())`;
    const params: any[] = [`%${keyword}%`];
    if (category) { sql += ' AND category = $2'; params.push(category); }
    sql += ` ORDER BY importance DESC, "updatedAt" DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    return query(sql, params);
  }
  
  // 3. 无keyword，按分类列出
  if (category) return query(`SELECT id, category, content, tags, importance, memory_tier, "createdAt" FROM user_memory WHERE category = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY importance DESC, "updatedAt" DESC LIMIT $2`, [category, limit]);
  return query(`SELECT id, category, content, tags, importance, memory_tier, "createdAt" FROM user_memory WHERE expires_at IS NULL OR expires_at > NOW() ORDER BY "updatedAt" DESC LIMIT $1`, [limit]);
}

export async function updateMemory(id: string, content: string, tags?: string): Promise<boolean> {
  const ex = await queryOne('SELECT id FROM user_memory WHERE id = $1', [id]);
  if (!ex) return false;
  // 重新生成embedding
  const emb = await generateEmbedding(content);
  const embStr = emb ? `[${emb.join(',')}]` : null;
  if (tags !== undefined) {
    await run('UPDATE user_memory SET content = $1, tags = $2, embedding = $3, "updatedAt" = NOW() WHERE id = $4', [content, tags, embStr, id]);
  } else {
    await run('UPDATE user_memory SET content = $1, embedding = $2, "updatedAt" = NOW() WHERE id = $3', [content, embStr, id]);
  }
  return true;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const ex = await queryOne('SELECT id FROM user_memory WHERE id = $1', [id]);
  if (!ex) return false;
  await run('DELETE FROM user_memory WHERE id = $1', [id]);
  return true;
}

export async function listMemoryCategories(): Promise<any[]> {
  return query(`SELECT category, COUNT(*) as count FROM user_memory WHERE expires_at IS NULL OR expires_at > NOW() GROUP BY category ORDER BY count DESC`);
}

// ============ 自动记忆提取（增强版：带embedding和分层） ============

export async function extractMemoriesFromConversation(messages: {role:string;content:string}[], model: any): Promise<string[]> {
  const userMsgs = messages.filter(m => m.role === 'user').slice(-6);
  if (userMsgs.length === 0) return [];
  const text = userMsgs.map(m => m.content.slice(0,500)).join('\n');
  try {
    const { generateObject } = await import('ai');
    const { object } = await generateObject({
      model,
      schema: z.object({
        memories: z.array(z.object({
          category: z.enum(['preference', 'personal', 'project', 'fact', 'habit', 'conversation_state', 'recent_context', 'general']).describe('记忆分类'),
          content: z.string().max(200).describe('记忆内容，简洁'),
          importance: z.number().min(1).max(5).optional().describe('重要度1-5'),
        })).describe('提取的记忆列表，没有值得记住的信息时为空数组'),
      }),
      prompt: `分析用户消息，提取值得记忆的信息。分类规则：
- conversation_state: 当前对话状态（短期，1小时后自动过期）
- recent_context: 近期上下文索引（中期，7天未访问降级）
- preference/personal/project/fact/habit: 长期记忆
只提取明确、稳定的信息，不要提取临时性内容。

消息：
${text}`,
      temperature: 0,
      maxOutputTokens: 500,
    });
    
    const saved: string[] = [];
    for (const it of object.memories) {
      if (it.content && it.content.length > 0 && it.content.length < 200) {
        const id = 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        const tier = inferTier(it.importance || 3, it.category);
        const expiresAt = TIER_EXPIRY[tier] !== 'never' 
          ? `NOW() + INTERVAL '${TIER_EXPIRY[tier]}'` 
          : null;
        
        // 生成embedding
        const emb = await generateEmbedding(it.content);
        const embStr = emb ? `[${emb.join(',')}]` : null;
        
        if (expiresAt) {
          await run(
            `INSERT INTO user_memory (id,category,content,tags,importance,memory_tier,expires_at,embedding,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '${TIER_EXPIRY[tier]}',$7,NOW(),NOW())`,
            [id, it.category, it.content, '', it.importance || 3, tier, embStr]
          );
        } else {
          await run(
            `INSERT INTO user_memory (id,category,content,tags,importance,memory_tier,expires_at,embedding,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,NOW(),NOW())`,
            [id, it.category, it.content, '', it.importance || 3, tier, embStr]
          );
        }
        saved.push(it.content);
      }
    }
    return saved;
  } catch { return []; }
}

// ============ 记忆降级：中期→长期 ============

export async function demoteStaleMidTermMemories(): Promise<number> {
  try {
    await run(
      `UPDATE user_memory SET memory_tier = 'long_term', expires_at = NULL WHERE memory_tier = 'mid_term' AND last_accessed_at < NOW() - INTERVAL '7 days'`
    );
    return 0;
  } catch { return 0; }
}

// ============ 清理过期短期记忆 ============

export async function cleanupExpiredMemories(): Promise<number> {
  try {
    await run(
      `DELETE FROM user_memory WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return 0;
  } catch { return 0; }
}

// ============ AI SDK 工具定义 ============

export const memoryTools = {
  saveMemory: tool({
    description: '保存一条用户记忆。当用户说"记住"或透露重要偏好/信息时使用。会自动生成embedding支持语义搜索。',
    parameters: z.object({
      category: z.string().describe('分类：preference/personal/project/fact/habit/conversation_state/recent_context'),
      content: z.string().describe('记忆内容，简洁'),
      tags: z.string().optional().describe('标签，逗号分隔'),
      importance: z.number().min(1).max(5).optional().describe('重要度1-5，默认3'),
    }),
    execute: async ({ category, content, tags, importance }) => {
      const id = 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      const tier = inferTier(importance || 3, category);
      const emb = await generateEmbedding(content);
      const embStr = emb ? `[${emb.join(',')}]` : null;
      
      if (tier === 'short_term') {
        await run(
          `INSERT INTO user_memory (id,category,content,tags,importance,memory_tier,expires_at,embedding,"createdAt","updatedAt",last_accessed_at) VALUES ($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '1 hour',$7,NOW(),NOW(),NOW())`,
          [id, category, content, tags||'', importance||3, tier, embStr]
        );
      } else {
        await run(
          `INSERT INTO user_memory (id,category,content,tags,importance,memory_tier,embedding,"createdAt","updatedAt",last_accessed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW(),NOW())`,
          [id, category, content, tags||'', importance||3, tier, embStr]
        );
      }
      return `已记住: [${category}/${tier}] ${content}`;
    },
  }),
  searchMemory: tool({
    description: '搜索已保存的记忆。支持语义搜索——即使关键词不完全匹配，也能通过语义相似度找到相关记忆。',
    parameters: z.object({
      keyword: z.string().describe('搜索关键词或语义描述'),
      category: z.string().optional().describe('限定分类'),
    }),
    execute: async ({ keyword, category }) => {
      const r = await searchMemories(keyword, category, 10);
      if (!r.length) return '未找到相关记忆';
      return r.map((x:any) => {
        const sim = x.similarity ? ` [相似度:${(x.similarity*100).toFixed(0)}%]` : '';
        return `[${x.id}] [${x.category}/${x.memory_tier||'long_term'}] ${x.content}${sim}`;
      }).join('\n');
    },
  }),
  updateMemory: tool({
    description: '更新一条记忆。会自动重新生成embedding。',
    parameters: z.object({ id: z.string().describe('记忆ID'), content: z.string().describe('新内容') }),
    execute: async ({ id, content }) => {
      const ok = await updateMemory(id, content);
      return ok ? `已更新 ${id}` : `记忆 ${id} 不存在`;
    },
  }),
  deleteMemory: tool({
    description: '删除一条记忆。用户要求"忘记"时使用。',
    parameters: z.object({ id: z.string().describe('记忆ID') }),
    execute: async ({ id }) => {
      const ok = await deleteMemory(id);
      return ok ? `已删除 ${id}` : `记忆 ${id} 不存在`;
    },
  }),
  listMemories: tool({
    description: '列出记忆分类或某分类下所有记忆。',
    parameters: z.object({ category: z.string().optional().describe('分类名，留空列所有分类') }),
    execute: async ({ category }) => {
      if (!category) {
        const cats = await listMemoryCategories();
        if (!cats.length) return '暂无记忆';
        return '记忆分类:\n' + cats.map((c:any) => `  ${c.category}: ${c.count}条`).join('\n');
      }
      const mems = await searchMemories('', category, 50);
      if (!mems.length) return `分类「${category}」下暂无记忆`;
      return mems.map((m:any) => `[${m.id}] [${m.memory_tier||'long'}] ${m.content}`).join('\n');
    },
  }),
};

// ============ 上下文注入 ============

export async function getMemoryContext(): Promise<string> {
  try {
    // 按层级加载：短期全部 + 中期最近 + 长期重要
    const rows = await query(`
      (SELECT id, category, content, memory_tier, importance FROM user_memory 
       WHERE memory_tier = 'short_term' AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY "updatedAt" DESC LIMIT 10)
      UNION ALL
      (SELECT id, category, content, memory_tier, importance FROM user_memory 
       WHERE memory_tier = 'mid_term' AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY last_accessed_at DESC LIMIT 15)
      UNION ALL
      (SELECT id, category, content, memory_tier, importance FROM user_memory 
       WHERE memory_tier = 'long_term' OR memory_tier IS NULL
       ORDER BY importance DESC, "updatedAt" DESC LIMIT 20)
    `);
    if (!rows?.length) return '';
    const grouped: Record<string,string[]> = {};
    for (const r of rows) { 
      const c = (r.memory_tier || 'long_term') + '/' + (r.category||'general'); 
      if(!grouped[c]) grouped[c]=[]; 
      grouped[c].push(r.content); 
    }
    return '\n\n【用户记忆（三层架构）】\n' + Object.entries(grouped).map(([c,items])=>`${c}: ${items.join('; ')}`).join('\n') + '\n\n用户说"记住"时用 saveMemory 保存。使用 searchMemory 语义搜索历史记忆。';
  } catch { return ''; }
}
