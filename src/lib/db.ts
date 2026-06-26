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
      user: process.env.DB_USER || 'ai_platform',
      password: process.env.DB_PASSWORD || 'AiPlatform2026!',
      database: process.env.DB_NAME || 'ai_platform',
      max: 10,
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
    'SELECT id, title, "modelId" as model_id, "createdAt" as created_at, "updatedAt" as updated_at FROM conversations ORDER BY "updatedAt" DESC LIMIT 100'
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

  const defaults = [
    { model_id: 'deepseek-v4-pro', display_name: 'DeepSeek V4 Pro', provider: 'deepseek', sort: 1 },
    { model_id: 'deepseek-v4-flash', display_name: 'DeepSeek V4 Flash', provider: 'deepseek', sort: 2 },
    { model_id: 'glm-5.2', display_name: 'GLM-5.2', provider: 'zhipu', sort: 3 },
    { model_id: 'glm-5-turbo', display_name: 'GLM-5 Turbo', provider: 'zhipu', sort: 4 },
    { model_id: 'qwen-3.7-max', display_name: '通义千问 3.7 Max', provider: 'qwen', sort: 5 },
    { model_id: 'kimi-k2.5', display_name: 'Kimi K2.5', provider: 'kimi', sort: 6 },
    { model_id: 'gpt-4o', display_name: 'GPT-4o', provider: 'openai', sort: 7 },
    { model_id: 'gpt-4o-mini', display_name: 'GPT-4o Mini', provider: 'openai', sort: 8 },
    { model_id: 'claude-4-sonnet', display_name: 'Claude 4 Sonnet', provider: 'anthropic', sort: 9 },
    { model_id: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', provider: 'google', sort: 10 },
  ];

  for (const m of defaults) {
    await upsertModelConfig({
      model_id: m.model_id,
      display_name: m.display_name,
      provider: m.provider,
      is_enabled: 1,
      sort_order: m.sort,
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
  const rows = await query(
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
  return rows;
}

export async function getRecentTelemetry(limit: number): Promise<any[]> {
  return await query(
    `SELECT * FROM ai_telemetry ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}
