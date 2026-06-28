import { Pool } from 'pg';
import type { Conversation, Message, ModelConfig, ApiKey } from '@/lib/types';
import { randomUUID } from 'crypto';

// PostgreSQL 连接池
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'agent',
      password: process.env.DB_PASSWORD || 'i3m8x5a2e8',
      database: process.env.DB_NAME || 'agent',
      max: 10,
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Wait max 5s for a connection
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getPool();
  const result = await p.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function run(sql: string, params?: any[]): Promise<void> {
  const p = getPool();
  await p.query(sql, params);
}

// ============ Conversations ============

export async function listConversations(): Promise<Conversation[]> {
  return query<Conversation>(
    'SELECT id, title, "modelId" as model_id, "userId", "createdAt" as created_at, "updatedAt" as updated_at FROM conversations ORDER BY "updatedAt" DESC LIMIT 100'
  );
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return queryOne<Conversation>(
    'SELECT id, title, "modelId" as model_id, "createdAt" as created_at, "updatedAt" as updated_at FROM conversations WHERE id = $1',
    [id]
  );
}

export async function createConversation(title: string, modelId: string): Promise<Conversation> {
  const id = randomUUID();
  await run(
    'INSERT INTO conversations (id, title, "modelId", "updatedAt") VALUES ($1, $2, $3, $4)',
    [id, title, modelId, new Date().toISOString()]
  );
  return getConversation(id) as Promise<Conversation>;
}

export async function updateConversation(id: string, updates: { title?: string; model_id?: string }): Promise<Conversation> {
  if (updates.title !== undefined) {
    await run('UPDATE conversations SET title = $1, "updatedAt" = NOW() WHERE id = $2', [updates.title, id]);
  }
  if (updates.model_id !== undefined) {
    await run('UPDATE conversations SET "modelId" = $1, "updatedAt" = NOW() WHERE id = $2', [updates.model_id, id]);
  }
  if (updates.title === undefined && updates.model_id === undefined) {
    await run('UPDATE conversations SET "updatedAt" = NOW() WHERE id = $1', [id]);
  }
  return getConversation(id) as Promise<Conversation>;
}

export async function deleteConversation(id: string): Promise<void> {
  await run('DELETE FROM conversations WHERE id = $1', [id]);
}

// ============ Messages ============

export async function getMessages(conversationId: string): Promise<Message[]> {
  return query<Message>(
    'SELECT id, "conversationId" as conversation_id, role, content, "modelId" as model_id, NULL as token_count, "createdAt" as created_at FROM chat_messages WHERE "conversationId" = $1 ORDER BY "createdAt" ASC',
    [conversationId]
  );
}

export async function createMessage(conversationId: string, role: string, content: string, modelId: string | null): Promise<Message> {
  const id = randomUUID();
  await run(
    'INSERT INTO chat_messages (id, "conversationId", role, content, "modelId") VALUES ($1, $2, $3, $4, $5)',
    [id, conversationId, role, content, modelId]
  );
  const row = await queryOne<any>(
    'SELECT id, "conversationId" as conversation_id, role, content, "modelId" as model_id, NULL as token_count, "createdAt" as created_at FROM chat_messages WHERE id = $1',
    [id]
  );
  return row;
}

// ============ Model Configs ============

export async function listModelConfigs(): Promise<ModelConfig[]> {
  return query<ModelConfig>(
    'SELECT id, "modelId" as model_id, name as display_name, provider, NULL as description, CASE WHEN "isActive" THEN 1 ELSE 0 END as is_enabled, 0.7 as default_temperature, 4096 as default_max_tokens, "sortOrder" as sort_order, "createdAt" as created_at, "updatedAt" as updated_at FROM model_configs ORDER BY "sortOrder" ASC'
  );
}

export async function getModelConfig(modelId: string): Promise<{ model_id: string; provider: string; display_name: string } | null> {
  return queryOne(
    'SELECT "modelId" as model_id, provider, name as display_name FROM model_configs WHERE "modelId" = $1 AND "isActive" = true',
    [modelId]
  );
}

export async function upsertModelConfig(input: {
  model_id: string;
  display_name: string;
  provider: string;
  description?: string;
  is_enabled?: number;
  default_temperature?: string;
  default_max_tokens?: number;
  sort_order?: number;
}): Promise<ModelConfig> {
  const id = randomUUID();
  const isActive = input.is_enabled !== 0;
  await run(
    `INSERT INTO model_configs (id, "modelId", name, provider, "isActive", "sortOrder", description, default_temperature, default_max_tokens, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT ("modelId") DO UPDATE SET name = $3, provider = $4, "isActive" = $5, "sortOrder" = $6, description = $7, default_temperature = $8, default_max_tokens = $9, "updatedAt" = NOW()`,
    [id, input.model_id, input.display_name, input.provider, isActive, input.sort_order || 0, input.description || '', parseFloat(input.default_temperature as any) || 0.7, input.default_max_tokens || 4096]
  );
  return (await getModelConfig(input.model_id)) as unknown as ModelConfig;
}

export async function deleteModelConfig(id: string): Promise<void> {
  await run('DELETE FROM model_configs WHERE id = $1', [id]);
}

export async function seedDefaultModels(): Promise<void> {
  // 检查是否已有数据
  const count = await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM model_configs');
  if (count && parseInt(count.cnt) > 0) return;

  // 从 models.ts 导入统一模型列表，避免多处维护
  const { MODELS } = await import('@/lib/models');
  let sort = 1;
  for (const m of MODELS) {
    await upsertModelConfig({
      model_id: m.id,
      display_name: m.name,
      provider: m.provider,
      is_enabled: 1,
      sort_order: sort++,
    });
  }
}

// ============ API Keys ============

export async function listApiKeys(): Promise<ApiKey[]> {
  return query<ApiKey>(
    'SELECT id, provider, name as provider_name, "apiKey" as api_key_encrypted, "baseUrl" as base_url, CASE WHEN "isActive" THEN 1 ELSE 0 END as is_active, "createdAt" as created_at, "updatedAt" as updated_at FROM api_keys ORDER BY provider ASC'
  );
}

export async function getApiKeyByProvider(provider: string): Promise<{ api_key_encrypted: string; base_url: string | null; is_active: number } | null> {
  return queryOne(
    'SELECT "apiKey" as api_key_encrypted, "baseUrl" as base_url, CASE WHEN "isActive" THEN 1 ELSE 0 END as is_active FROM api_keys WHERE provider = $1 AND "isActive" = true',
    [provider]
  );
}

export async function upsertApiKey(input: {
  provider: string;
  provider_name: string;
  api_key_encrypted: string;
  base_url?: string;
  is_active?: boolean;
}): Promise<ApiKey> {
  const id = randomUUID();
  const isActive = input.is_active !== false;
  await run(
    `INSERT INTO api_keys (id, provider, name, "apiKey", "baseUrl", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (provider) DO UPDATE SET name = $3, "apiKey" = $4, "baseUrl" = $5, "isActive" = $6, "updatedAt" = NOW()`,
    [id, input.provider, input.provider_name, input.api_key_encrypted, input.base_url || null, isActive]
  );
  return (await listApiKeys()).find(k => k.provider === input.provider) as ApiKey;
}

export async function deleteApiKey(id: string): Promise<void> {
  await run('DELETE FROM api_keys WHERE id = $1', [id]);
}

// 别名导出，兼容旧代码
export const listMessages = getMessages;
export const getApiKey = getApiKeyByProvider;

// ============ Settings (key-value store) ============

async function ensureSettingsTable(): Promise<void> {
  await run(`CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    "updatedAt" TIMESTAMP DEFAULT NOW()
  )`);
}

export async function getSetting(key: string): Promise<string | null> {
  await ensureSettingsTable();
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  );
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSettingsTable();
  await run(
    `INSERT INTO settings (key, value, "updatedAt") VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  await ensureSettingsTable();
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
// ============ Projects ============

export async function listProjects(): Promise<any[]> {
  return query('SELECT id, name, description, tech_stack, "createdAt", "updatedAt" FROM projects ORDER BY "updatedAt" DESC');
}

export async function getProject(id: string): Promise<any | null> {
  return queryOne('SELECT id, name, description, tech_stack, "createdAt", "updatedAt" FROM projects WHERE id = $1', [id]);
}

export async function createProject(name: string, description?: string): Promise<any> {
  const id = randomUUID();
  await run('INSERT INTO projects (id, name, description, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())', [id, name, description || null]);
  return getProject(id);
}

export async function updateProject(id: string, updates: { name?: string; description?: string }): Promise<any> {
  if (updates.name !== undefined) {
    await run('UPDATE projects SET name = $1, "updatedAt" = NOW() WHERE id = $2', [updates.name, id]);
  }
  if (updates.description !== undefined) {
    await run('UPDATE projects SET description = $1, "updatedAt" = NOW() WHERE id = $2', [updates.description, id]);
  }
  return getProject(id);
}

export async function deleteProject(id: string): Promise<void> {
  await run('DELETE FROM projects WHERE id = $1', [id]);
}

// ============ Workspace Conversations ============

export async function listWorkspaceConversations(projectId: string): Promise<any[]> {
  return query('SELECT id, "projectId", title, "createdAt", "updatedAt" FROM workspace_conversations WHERE "projectId" = $1 ORDER BY "updatedAt" DESC', [projectId]);
}

export async function getWorkspaceConversation(id: string): Promise<any | null> {
  return queryOne('SELECT id, "projectId", title, "createdAt", "updatedAt" FROM workspace_conversations WHERE id = $1', [id]);
}

export async function getWorkspaceConversationWithMessages(id: string): Promise<any | null> {
  const conv = await getWorkspaceConversation(id);
  if (!conv) return null;
  const messages = await query('SELECT id, "conversationId", role, content, "modelId", attachments, "fileChanges", "createdAt" FROM workspace_messages WHERE "conversationId" = $1 ORDER BY "createdAt" ASC', [id]);
  return { ...conv, messages };
}

export async function createWorkspaceConversation(projectId: string, title: string): Promise<any> {
  const id = randomUUID();
  await run('INSERT INTO workspace_conversations (id, "projectId", title, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())', [id, projectId, title]);
  return getWorkspaceConversation(id);
}

export async function deleteWorkspaceConversation(id: string): Promise<void> {
  await run('DELETE FROM workspace_conversations WHERE id = $1', [id]);
}

// ============ Workspace Files ============

export async function listWorkspaceFiles(projectId: string): Promise<any[]> {
  return query('SELECT id, "projectId", name, path, content, language, type, "parentId", "createdAt", "updatedAt" FROM workspace_files WHERE "projectId" = $1 ORDER BY path ASC', [projectId]);
}

export async function getWorkspaceFile(id: string): Promise<any | null> {
  return queryOne('SELECT id, "projectId", name, path, content, language, type, "parentId", "createdAt", "updatedAt" FROM workspace_files WHERE id = $1', [id]);
}

export async function upsertWorkspaceFile(projectId: string, path: string, content: string): Promise<void> {
  const name = path.split('/').pop() || path;
  const existing = await queryOne('SELECT id FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
  if (existing) {
    await run('UPDATE workspace_files SET content = $1, "updatedAt" = NOW() WHERE id = $2', [content, existing.id]);
  } else {
    const id = randomUUID();
    await run("INSERT INTO workspace_files (id, \"projectId\", name, path, content, type, \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, 'file', NOW(), NOW())", [id, projectId, name, path, content]);
  }
}

export async function updateWorkspaceFile(id: string, updates: { name?: string; content?: string; path?: string }): Promise<any> {
  if (updates.name !== undefined) await run('UPDATE workspace_files SET name = $1, "updatedAt" = NOW() WHERE id = $2', [updates.name, id]);
  if (updates.content !== undefined) await run('UPDATE workspace_files SET content = $1, "updatedAt" = NOW() WHERE id = $2', [updates.content, id]);
  if (updates.path !== undefined) await run('UPDATE workspace_files SET path = $1, "updatedAt" = NOW() WHERE id = $2', [updates.path, id]);
  return getWorkspaceFile(id);
}

export async function deleteWorkspaceFile(id: string): Promise<void> {
  await run('DELETE FROM workspace_files WHERE id = $1', [id]);
}

export async function deleteWorkspaceFileByPath(projectId: string, path: string): Promise<void> {
  await run('DELETE FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
}

// ====== Telemetry functions (added by fix script) ======

export async function saveTelemetry(data: {
  provider: string;
  model: string;
  operation: string;
  duration_ms?: number;
  success?: boolean;
  error_code?: string;
  error_message?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  user_id?: string;
}): Promise<void> {
  await run(
    `INSERT INTO ai_telemetry (provider, model, operation, duration_ms, success, error_code, error_message, prompt_tokens, completion_tokens, total_tokens, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      data.provider, data.model, data.operation,
      data.duration_ms || null,
      data.success !== undefined ? data.success : true,
      data.error_code || null,
      data.error_message || null,
      data.prompt_tokens || 0,
      data.completion_tokens || 0,
      data.total_tokens || 0,
      data.user_id || null,
    ]
  );
}

export async function cleanupTelemetry(daysOld: number): Promise<void> {
  await run(
    `DELETE FROM ai_telemetry WHERE created_at < NOW() - INTERVAL '${daysOld} days'`
  );
}

export async function getTelemetryStats(hours: number): Promise<any> {
  const rows: any[] = await query(
    `SELECT provider, model, operation,
            COUNT(*) as call_count,
            AVG(duration_ms) as avg_duration_ms,
            SUM(total_tokens) as total_tokens,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as error_count
     FROM ai_telemetry
     WHERE created_at >= NOW() - INTERVAL '${hours} hours'
     GROUP BY provider, model, operation
     ORDER BY call_count DESC`
  );

  // Build overall stats
  let totalCalls = 0, successCalls = 0, totalTokens = 0, totalPromptTokens = 0, totalCompletionTokens = 0;
  let weightedDuration = 0;
  for (const r of rows) {
    const cnt = parseInt(r.call_count) || 0;
    totalCalls += cnt;
    successCalls += parseInt(r.success_count) || 0;
    totalTokens += parseInt(r.total_tokens) || 0;
    weightedDuration += (parseFloat(r.avg_duration_ms) || 0) * cnt;
  }

  // Get prompt/completion token split if available
  try {
    const tokenRows: any[] = await query(
      `SELECT SUM(prompt_tokens) as pt, SUM(completion_tokens) as ct FROM ai_telemetry WHERE created_at >= NOW() - INTERVAL '${hours} hours'`
    );
    if (tokenRows[0]) {
      totalPromptTokens = parseInt(tokenRows[0].pt) || 0;
      totalCompletionTokens = parseInt(tokenRows[0].ct) || 0;
    }
  } catch {}

  // Build byProvider
  const providerMap: Record<string, any> = {};
  for (const r of rows) {
    const key = r.provider || 'unknown';
    if (!providerMap[key]) providerMap[key] = { provider: key, count: 0, avg_duration: 0, total_tokens: 0, success_count: 0, _weighted: 0 };
    const cnt = parseInt(r.call_count) || 0;
    providerMap[key].count += cnt;
    providerMap[key].total_tokens += parseInt(r.total_tokens) || 0;
    providerMap[key].success_count += parseInt(r.success_count) || 0;
    providerMap[key]._weighted += (parseFloat(r.avg_duration_ms) || 0) * cnt;
  }
  const byProvider = Object.values(providerMap).map((p: any) => ({
    provider: p.provider, count: p.count,
    avg_duration: p.count > 0 ? Math.round(p._weighted / p.count) : 0,
    total_tokens: p.total_tokens, success_count: p.success_count
  }));

  // Build byModel
  const modelMap: Record<string, any> = {};
  for (const r of rows) {
    const key = (r.provider || '') + ':' + (r.model || '');
    if (!modelMap[key]) modelMap[key] = { model: r.model, provider: r.provider, count: 0, avg_duration: 0, total_tokens: 0, _weighted: 0 };
    const cnt = parseInt(r.call_count) || 0;
    modelMap[key].count += cnt;
    modelMap[key].total_tokens += parseInt(r.total_tokens) || 0;
    modelMap[key]._weighted += (parseFloat(r.avg_duration_ms) || 0) * cnt;
  }
  const byModel = Object.values(modelMap).map((m: any) => ({
    model: m.model, provider: m.provider, count: m.count,
    avg_duration: m.count > 0 ? Math.round(m._weighted / m.count) : 0,
    total_tokens: m.total_tokens
  }));

  // Build errors
  const errorRows: any[] = await query(
    `SELECT error_code, COUNT(*) as count, model, provider FROM ai_telemetry WHERE success = false AND created_at >= NOW() - INTERVAL '${hours} hours' GROUP BY error_code, model, provider ORDER BY count DESC LIMIT 10`
  ).catch(() => []);

  return {
    period: hours + 'h',
    overall: {
      totalCalls,
      successCalls,
      successRate: totalCalls > 0 ? Math.round(successCalls / totalCalls * 100) : 0,
      avgDuration: totalCalls > 0 ? Math.round(weightedDuration / totalCalls) : 0,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
    },
    byProvider,
    byModel,
    hourlyTrend: [],
    errors: errorRows.map((r: any) => ({ error_code: r.error_code || 'unknown', count: parseInt(r.count), model: r.model, provider: r.provider })),
  };
}

export async function getRecentTelemetry(limit: number): Promise<any[]> {
  return await query(
    `SELECT * FROM ai_telemetry ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}


// ============ User-scoped Conversations ============

export async function listConversationsByUser(userId: string | null, role?: string): Promise<Conversation[]> {
  // Admin users can see all conversations
  if (role === 'admin') {
    return query<Conversation>(
      'SELECT id, title, "modelId" as model_id, "userId", "createdAt" as created_at, "updatedAt" as updated_at FROM conversations ORDER BY "updatedAt" DESC LIMIT 100',
      []
    );
  }
  // Anonymous users see conversations with NULL userId (their own anonymous conversations)
  if (!userId) {
    return query<Conversation>(
      'SELECT id, title, "modelId" as model_id, "userId", "createdAt" as created_at, "updatedAt" as updated_at FROM conversations WHERE "userId" IS NULL ORDER BY "updatedAt" DESC LIMIT 100',
      []
    );
  }
  // Regular users see their own conversations
  return query<Conversation>(
    'SELECT id, title, "modelId" as model_id, "userId", "createdAt" as created_at, "updatedAt" as updated_at FROM conversations WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 100',
    [userId]
  );
}

export async function createConversationWithUser(id: string, title: string, modelId: string | null, userId: string | null): Promise<void> {
  const now = new Date().toISOString();
  await run(
    'INSERT INTO conversations (id, title, "modelId", "userId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)',
    [id, title, modelId, userId, now, now]
  );
}

export async function setConversationUserId(conversationId: string, userId: string): Promise<void> {
  await run(
    'UPDATE conversations SET "userId" = $1, "updatedAt" = $2 WHERE id = $3',
    [userId, new Date().toISOString(), conversationId]
  );
}


// ============ Full-text Search ============

export async function searchConversationsAndMessages(searchText: string, userId: string, limit: number = 20, role?: string): Promise<any[]> {
  const userFilter = role === 'admin' ? 'TRUE' : 'c."userId" = $2';
  const params = role === 'admin' ? [searchText, limit] : [searchText, userId, limit];
  const limitParam = role === 'admin' ? '$2' : '$3';
  const sql = `
    WITH msg_matches AS (
      SELECT c.id as conversation_id, c.title,
        ts_headline('simple', m.content, websearch_to_tsquery('simple', $1), 'MaxWords=35,MinWords=15,ShortWord=3,HighlightAll=FALSE') as highlight
      FROM conversations c
      JOIN chat_messages m ON m."conversationId" = c.id
      WHERE ${userFilter}
        AND to_tsvector('simple', m.content) @@ websearch_to_tsquery('simple', $1)
      ORDER BY c."updatedAt" DESC
      LIMIT ${limitParam}
    ),
    title_matches AS (
      SELECT c.id as conversation_id, c.title,
        ts_headline('simple', c.title, websearch_to_tsquery('simple', $1), 'MaxWords=35,MinWords=15,ShortWord=3,HighlightAll=FALSE') as highlight
      FROM conversations c
      WHERE ${userFilter}
        AND to_tsvector('simple', c.title) @@ websearch_to_tsquery('simple', $1)
        AND c.id NOT IN (SELECT conversation_id FROM msg_matches)
      ORDER BY c."updatedAt" DESC
      LIMIT ${limitParam}
    )
    SELECT * FROM msg_matches UNION ALL SELECT * FROM title_matches ORDER BY title
  `;
  return await query(sql, params);
}
export function highlightMatch(text: string, keyword: string): string {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

