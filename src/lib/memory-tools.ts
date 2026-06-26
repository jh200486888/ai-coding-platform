import { z } from 'zod';
import { tool } from 'ai';
import { query, queryOne, run } from '@/lib/db';

export async function searchMemories(keyword: string, category?: string, limit: number = 10): Promise<any[]> {
  if (keyword.trim()) {
    let sql = `SELECT id, category, content, tags, importance, "createdAt" FROM user_memory WHERE (content ILIKE $1 OR category ILIKE $1 OR tags ILIKE $1)`;
    const params: any[] = [`%${keyword}%`];
    if (category) { sql += ' AND category = $2'; params.push(category); }
    sql += ` ORDER BY importance DESC, "updatedAt" DESC LIMIT $` + (params.length + 1);
    params.push(limit);
    return query(sql, params);
  }
  if (category) return query(`SELECT id, category, content, tags, importance, "createdAt" FROM user_memory WHERE category = $1 ORDER BY importance DESC, "updatedAt" DESC LIMIT $2`, [category, limit]);
  return query(`SELECT id, category, content, tags, importance, "createdAt" FROM user_memory ORDER BY "updatedAt" DESC LIMIT $1`, [limit]);
}

export async function updateMemory(id: string, content: string, tags?: string): Promise<boolean> {
  const ex = await queryOne('SELECT id FROM user_memory WHERE id = $1', [id]);
  if (!ex) return false;
  if (tags !== undefined) await run('UPDATE user_memory SET content = $1, tags = $2, "updatedAt" = NOW() WHERE id = $3', [content, tags, id]);
  else await run('UPDATE user_memory SET content = $1, "updatedAt" = NOW() WHERE id = $2', [content, id]);
  return true;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const ex = await queryOne('SELECT id FROM user_memory WHERE id = $1', [id]);
  if (!ex) return false;
  await run('DELETE FROM user_memory WHERE id = $1', [id]);
  return true;
}

export async function listMemoryCategories(): Promise<any[]> {
  return query(`SELECT category, COUNT(*) as count FROM user_memory GROUP BY category ORDER BY count DESC`);
}

export async function extractMemoriesFromConversation(messages: {role:string;content:string}[], model: any): Promise<string[]> {
  const userMsgs = messages.filter(m => m.role === 'user').slice(-6);
  if (userMsgs.length === 0) return [];
  const text = userMsgs.map(m => m.content.slice(0,500)).join('\n');
  try {
    const { generateText } = await import('ai');
    const { text: result } = await generateText({ model, prompt: `分析用户消息，提取值得长期记忆的信息（偏好/个人信息/项目）。无则返回[]。格式：[{"category":"preference","content":"..."}]\n\n消息：\n${text}`, temperature: 0, maxOutputTokens: 500 });
    const m = result.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const items = JSON.parse(m[0]);
    const saved: string[] = [];
    for (const it of items) {
      if (it.content && it.content.length < 200) {
        const id = 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        await run('INSERT INTO user_memory (id,category,content,tags,importance,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())', [id, it.category||'general', it.content, '', 3]);
        saved.push(it.content);
      }
    }
    return saved;
  } catch { return []; }
}

export const memoryTools = {
  saveMemory: tool({
    description: '保存一条用户记忆。当用户说"记住"或透露重要偏好/信息时使用。',
    inputSchema: z.object({
      category: z.string().describe('分类：preference/personal/project/fact/habit'),
      content: z.string().describe('记忆内容，简洁'),
      tags: z.string().optional().describe('标签，逗号分隔'),
      importance: z.number().min(1).max(5).optional().describe('重要度1-5，默认3'),
    }),
    execute: async ({ category, content, tags, importance }) => {
      const id = 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      await run('INSERT INTO user_memory (id,category,content,tags,importance,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())', [id, category, content, tags||'', importance||3]);
      return `已记住: [${category}] ${content}`;
    },
  }),
  searchMemory: tool({
    description: '搜索已保存的记忆。',
    inputSchema: z.object({
      keyword: z.string().describe('搜索关键词'),
      category: z.string().optional().describe('限定分类'),
    }),
    execute: async ({ keyword, category }) => {
      const r = await searchMemories(keyword, category, 10);
      if (!r.length) return '未找到相关记忆';
      return r.map((x:any) => `[${x.id}] [${x.category}] ${x.content}`).join('\n');
    },
  }),
  updateMemory: tool({
    description: '更新一条记忆。',
    inputSchema: z.object({ id: z.string().describe('记忆ID'), content: z.string().describe('新内容') }),
    execute: async ({ id, content }) => {
      const ok = await updateMemory(id, content);
      return ok ? `已更新 ${id}` : `记忆 ${id} 不存在`;
    },
  }),
  deleteMemory: tool({
    description: '删除一条记忆。用户要求"忘记"时使用。',
    inputSchema: z.object({ id: z.string().describe('记忆ID') }),
    execute: async ({ id }) => {
      const ok = await deleteMemory(id);
      return ok ? `已删除 ${id}` : `记忆 ${id} 不存在`;
    },
  }),
  listMemories: tool({
    description: '列出记忆分类或某分类下所有记忆。',
    inputSchema: z.object({ category: z.string().optional().describe('分类名，留空列所有分类') }),
    execute: async ({ category }) => {
      if (!category) {
        const cats = await listMemoryCategories();
        if (!cats.length) return '暂无记忆';
        return '记忆分类:\n' + cats.map((c:any) => `  ${c.category}: ${c.count}条`).join('\n');
      }
      const mems = await searchMemories('', category, 50);
      if (!mems.length) return `分类「${category}」下暂无记忆`;
      return mems.map((m:any) => `[${m.id}] ${m.content}`).join('\n');
    },
  }),
};

export async function getMemoryContext(): Promise<string> {
  try {
    const rows = await query('SELECT category, content FROM user_memory ORDER BY importance DESC, "updatedAt" DESC LIMIT 30');
    if (!rows?.length) return '';
    const grouped: Record<string,string[]> = {};
    for (const r of rows) { const c = r.category||'general'; if(!grouped[c]) grouped[c]=[]; grouped[c].push(r.content); }
    return '\n\n【用户记忆】\n' + Object.entries(grouped).map(([c,items])=>`${c}: ${items.join('; ')}`).join('\n') + '\n\n用户说"记住"时用 saveMemory 保存。';
  } catch { return ''; }
}
