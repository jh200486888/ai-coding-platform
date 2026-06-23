import { query, initDatabase } from '@/storage/database/mysql-client';
import type { Conversation, Message, ModelConfig, ApiKey } from '@/lib/types';
import { randomUUID } from 'crypto';

// Initialize database on first import
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

// ============ Conversations ============

export async function listConversations(): Promise<Conversation[]> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT id, title, model_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100'
  );
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    model_id: row.model_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT id, title, model_id, created_at, updated_at FROM conversations WHERE id = ?',
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    title: row.title,
    model_id: row.model_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createConversation(
  title: string,
  modelId: string
): Promise<Conversation> {
  await ensureDbInitialized();
  const id = randomUUID();
  await query(
    'INSERT INTO conversations (id, title, model_id) VALUES (?, ?, ?)',
    [id, title, modelId]
  );
  const rows = await query<any[]>(
    'SELECT id, title, model_id, created_at, updated_at FROM conversations WHERE id = ?',
    [id]
  );
  const row = rows[0];
  return {
    id: row.id,
    title: row.title,
    model_id: row.model_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateConversation(
  id: string,
  updates: { title?: string; model_id?: string }
): Promise<Conversation> {
  await ensureDbInitialized();
  const setClauses = [];
  const values = [];
  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model_id !== undefined) {
    setClauses.push('model_id = ?');
    values.push(updates.model_id);
  }
  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  await query(
    `UPDATE conversations SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
  
  const rows = await query<any[]>(
    'SELECT id, title, model_id, created_at, updated_at FROM conversations WHERE id = ?',
    [id]
  );
  const row = rows[0];
  return {
    id: row.id,
    title: row.title,
    model_id: row.model_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function deleteConversation(id: string): Promise<void> {
  await ensureDbInitialized();
  await query('DELETE FROM conversations WHERE id = ?', [id]);
}

// ============ Messages ============

export async function listMessages(conversationId: string): Promise<Message[]> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT id, conversation_id, role, content, model_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200',
    [conversationId]
  );
  return rows.map(row => ({
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    model_id: row.model_id,
    token_count: null,
    created_at: row.created_at,
  })) as Message[];
}

export async function createMessage(
  conversationId: string,
  role: string,
  content: string,
  modelId?: string
): Promise<Message> {
  await ensureDbInitialized();
  const id = randomUUID();
  await query(
    'INSERT INTO messages (id, conversation_id, role, content, model_id) VALUES (?, ?, ?, ?, ?)',
    [id, conversationId, role, content, modelId || null]
  );
  const rows = await query<any[]>(
    'SELECT id, conversation_id, role, content, model_id, created_at FROM messages WHERE id = ?',
    [id]
  );
  const row = rows[0];
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    model_id: row.model_id,
    token_count: null,
    created_at: row.created_at,
  } as Message;
}

// ============ Model Configs ============

export async function listModelConfigs(): Promise<ModelConfig[]> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT * FROM model_configs ORDER BY sort_order ASC LIMIT 100'
  );
  return rows.map(row => ({
    id: row.id,
    model_id: row.model_id,
    display_name: row.display_name,
    provider: row.provider,
    description: row.description,
    is_enabled: row.is_enabled,
    default_temperature: row.default_temperature?.toString() || '0.7',
    default_max_tokens: row.default_max_tokens,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function upsertModelConfig(config: Partial<ModelConfig> & { model_id: string; display_name: string; provider: string }): Promise<ModelConfig> {
  await ensureDbInitialized();
  const existing = await query<any[]>(
    'SELECT id FROM model_configs WHERE model_id = ?',
    [config.model_id]
  );
  
  if (existing.length > 0) {
    const id = existing[0].id;
    const setClauses = [];
    const values = [];
    if (config.display_name !== undefined) {
      setClauses.push('display_name = ?');
      values.push(config.display_name);
    }
    if (config.provider !== undefined) {
      setClauses.push('provider = ?');
      values.push(config.provider);
    }
    if (config.description !== undefined) {
      setClauses.push('description = ?');
      values.push(config.description || null);
    }
    if (config.is_enabled !== undefined) {
      setClauses.push('is_enabled = ?');
      values.push(config.is_enabled);
    }
    if (config.default_temperature !== undefined) {
      setClauses.push('default_temperature = ?');
      values.push(config.default_temperature ? parseFloat(config.default_temperature) : 0.7);
    }
    if (config.default_max_tokens !== undefined) {
      setClauses.push('default_max_tokens = ?');
      values.push(config.default_max_tokens);
    }
    if (config.sort_order !== undefined) {
      setClauses.push('sort_order = ?');
      values.push(config.sort_order);
    }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await query(
      `UPDATE model_configs SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );
    
    const rows = await query<any[]>('SELECT * FROM model_configs WHERE id = ?', [id]);
    const row = rows[0];
    return {
      id: row.id,
      model_id: row.model_id,
      display_name: row.display_name,
      provider: row.provider,
      description: row.description,
      is_enabled: row.is_enabled,
      default_temperature: row.default_temperature?.toString() || '0.7',
      default_max_tokens: row.default_max_tokens,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } else {
    const id = randomUUID();
    await query(
      `INSERT INTO model_configs (id, model_id, display_name, provider, description, is_enabled, default_temperature, default_max_tokens, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.model_id,
        config.display_name,
        config.provider,
        config.description || null,
        config.is_enabled !== undefined ? config.is_enabled : 1,
        config.default_temperature ? parseFloat(config.default_temperature) : 0.7,
        config.default_max_tokens || 4096,
        config.sort_order || 0,
      ]
    );
    
    const rows = await query<any[]>('SELECT * FROM model_configs WHERE id = ?', [id]);
    const row = rows[0];
    return {
      id: row.id,
      model_id: row.model_id,
      display_name: row.display_name,
      provider: row.provider,
      description: row.description,
      is_enabled: row.is_enabled,
      default_temperature: row.default_temperature?.toString() || '0.7',
      default_max_tokens: row.default_max_tokens,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export async function deleteModelConfig(id: string): Promise<void> {
  await ensureDbInitialized();
  await query('DELETE FROM model_configs WHERE id = ?', [id]);
}

export async function toggleModelConfig(id: string, isEnabled: boolean): Promise<void> {
  await ensureDbInitialized();
  await query('UPDATE model_configs SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [isEnabled ? 1 : 0, id]);
}

// ============ API Keys ============

export async function listApiKeys(): Promise<ApiKey[]> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT * FROM api_keys ORDER BY provider ASC LIMIT 50'
  );
  return rows.map(row => ({
    id: row.id,
    provider: row.provider,
    provider_name: row.provider_name,
    api_key_encrypted: row.api_key_encrypted,
    base_url: row.base_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getApiKey(provider: string): Promise<ApiKey | null> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT * FROM api_keys WHERE provider = ?',
    [provider]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    provider: row.provider,
    provider_name: row.provider_name,
    api_key_encrypted: row.api_key_encrypted,
    base_url: row.base_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// 根据 provider 获取 API Key（用于 LLM 调用）
export async function getApiKeyByProvider(provider: string): Promise<{ api_key_encrypted: string; base_url: string | null; is_active: number } | null> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT api_key_encrypted, base_url, is_active FROM api_keys WHERE provider = ? AND is_active = 1',
    [provider]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

// 获取模型配置（用于 LLM 调用）
export async function getModelConfig(modelId: string): Promise<{ model_id: string; provider: string; display_name: string } | null> {
  await ensureDbInitialized();
  const rows = await query<any[]>(
    'SELECT model_id, provider, display_name FROM model_configs WHERE model_id = ? AND is_enabled = 1',
    [modelId]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export async function upsertApiKey(input: {
  provider: string;
  provider_name: string;
  api_key_encrypted: string;
  base_url?: string;
  is_active?: boolean;
}): Promise<ApiKey> {
  await ensureDbInitialized();
  const existing = await query<any[]>(
    'SELECT id FROM api_keys WHERE provider = ?',
    [input.provider]
  );
  
  if (existing.length > 0) {
    const id = existing[0].id;
    await query(
      `UPDATE api_keys SET provider_name = ?, api_key_encrypted = ?, base_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        input.provider_name,
        input.api_key_encrypted,
        input.base_url || null,
        input.is_active !== false ? 1 : 0,
        id,
      ]
    );
    
    const rows = await query<any[]>('SELECT * FROM api_keys WHERE id = ?', [id]);
    const row = rows[0];
    return {
      id: row.id,
      provider: row.provider,
      provider_name: row.provider_name,
      api_key_encrypted: row.api_key_encrypted,
      base_url: row.base_url,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } else {
    const id = randomUUID();
    await query(
      `INSERT INTO api_keys (id, provider, provider_name, api_key_encrypted, base_url, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.provider,
        input.provider_name,
        input.api_key_encrypted,
        input.base_url || null,
        input.is_active !== false ? 1 : 0,
      ]
    );
    
    const rows = await query<any[]>('SELECT * FROM api_keys WHERE id = ?', [id]);
    const row = rows[0];
    return {
      id: row.id,
      provider: row.provider,
      provider_name: row.provider_name,
      api_key_encrypted: row.api_key_encrypted,
      base_url: row.base_url,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export async function deleteApiKey(id: string): Promise<void> {
  await ensureDbInitialized();
  await query('DELETE FROM api_keys WHERE id = ?', [id]);
}

// ============ Seed default models ============

const DEFAULT_MODELS = [
  // ============ 国内大模型（2026年6月最新） ============
  // 深度求索 - DeepSeek
  { model_id: 'deepseek-v4-pro', display_name: 'DeepSeek V4 Pro', provider: 'deepseek', description: '旗舰模型，1M上下文，LiveCodeBench 93.5%', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 1 },
  { model_id: 'deepseek-v4-flash', display_name: 'DeepSeek V4 Flash', provider: 'deepseek', description: '轻量高性价比，1M上下文', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 2 },

  // 智谱 - GLM
  { model_id: 'glm-5.2', display_name: 'GLM-5.2', provider: 'zhipu', description: '最新旗舰，1M上下文，编程开源SOTA', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 3 },
  { model_id: 'glm-5.1', display_name: 'GLM-5.1', provider: 'zhipu', description: '前代旗舰，1M上下文', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 4 },
  { model_id: 'glm-5v-turbo', display_name: 'GLM-5V Turbo', provider: 'zhipu', description: '多模态Coding基座，视觉理解+Coding', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 5 },
  { model_id: 'glm-5-turbo', display_name: 'GLM-5 Turbo', provider: 'zhipu', description: '龙虾增强基座模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 6 },
  { model_id: 'glm-image', display_name: 'GLM-Image', provider: 'zhipu', description: '图像生成模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 7 },
  { model_id: 'glm-4.7-flash', display_name: 'GLM-4.7 Flash', provider: 'zhipu', description: '免费模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 8 },
  { model_id: 'glm-4.7', display_name: 'GLM-4.7', provider: 'zhipu', description: '基座模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 9 },
  { model_id: 'glm-4.6v', display_name: 'GLM-4.6V', provider: 'zhipu', description: '视觉推理模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 10 },

  // 月之暗面 - Kimi
  { model_id: 'kimi-k2.5', display_name: 'Kimi K2.5', provider: 'kimi', description: '月之暗面最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 11 },

  // 阿里 - 通义千问
  { model_id: 'qwen-3.7-max', display_name: '通义千问 3.7 Max', provider: 'qwen', description: '阿里最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 12 },
  { model_id: 'qwen-3.6-35b', display_name: '通义千问 3.6 35B', provider: 'qwen', description: '35B参数版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 13 },

  // 百度 - 文心一言
  { model_id: 'ernie-5.0', display_name: '文心一言 5.0', provider: 'baidu', description: '百度最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 14 },

  // 讯飞 - 星火
  { model_id: 'spark-4.0-ultra', display_name: '讯飞星火 4.0 Ultra', provider: 'spark', description: '讯飞最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 15 },

  // MiniMax
  { model_id: 'minimax-01', display_name: 'MiniMax-01', provider: 'minimax', description: 'MiniMax最新模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 16 },

  // 零一万物 - Yi
  { model_id: 'yi-large', display_name: 'Yi-Large', provider: 'yi', description: '零一万物旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 17 },

  // ============ 国外大模型（2026年6月最新） ============
  // OpenAI
  { model_id: 'gpt-5.5-instant', display_name: 'GPT-5.5 Instant', provider: 'openai', description: '默认模型，幻觉率大降52.5%', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 30 },
  { model_id: 'gpt-5.5-cyber', display_name: 'GPT-5.5 Cyber', provider: 'openai', description: '网络安全专业模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 31 },
  { model_id: 'gpt-5', display_name: 'GPT-5', provider: 'openai', description: '旗舰模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 32 },
  { model_id: 'gpt-5-thinking', display_name: 'GPT-5 Thinking', provider: 'openai', description: '深度推理', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 33 },
  { model_id: 'gpt-5-codex', display_name: 'GPT-5 Codex', provider: 'openai', description: '编程专用', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 34 },
  { model_id: 'gpt-4.1', display_name: 'GPT-4.1', provider: 'openai', description: '高效模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 35 },
  { model_id: 'gpt-4.1-mini', display_name: 'GPT-4.1 Mini', provider: 'openai', description: '轻量模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 36 },

  // Anthropic - Claude
  { model_id: 'claude-fable-5', display_name: 'Claude Fable 5', provider: 'anthropic', description: '旗舰编程模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 40 },
  { model_id: 'claude-opus-4.8', display_name: 'Claude Opus 4.8', provider: 'anthropic', description: '最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 41 },
  { model_id: 'claude-opus-4.7', display_name: 'Claude Opus 4.7', provider: 'anthropic', description: '上代旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 42 },
  { model_id: 'claude-sonnet-4.8', display_name: 'Claude Sonnet 4.8', provider: 'anthropic', description: '平衡性价比', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 43 },
  { model_id: 'claude-mythos-5', display_name: 'Claude Mythos 5', provider: 'anthropic', description: '推理旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 44 },

  // Google - Gemini
  { model_id: 'gemini-3.5-flash', display_name: 'Gemini 3.5 Flash', provider: 'google', description: '最新Agent SOTA，289 tok/s', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 50 },
  { model_id: 'gemini-3.5-pro', display_name: 'Gemini 3.5 Pro', provider: 'google', description: '即将发布，编程达到GPT-5.5的92%', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 51 },
  { model_id: 'gemini-3.1-pro', display_name: 'Gemini 3.1 Pro', provider: 'google', description: '上代旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 52 },
  { model_id: 'gemini-omni', display_name: 'Gemini Omni', provider: 'google', description: '世界模型，支持视频生成', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 53 },

  // Meta - Llama
  { model_id: 'llama-4-scout', display_name: 'Llama 4 Scout', provider: 'meta', description: '1000万token上下文', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 60 },
  { model_id: 'llama-4-maverick', display_name: 'Llama 4 Maverick', provider: 'meta', description: 'Meta最新模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 61 },
];

export async function seedDefaultModels(): Promise<void> {
  await ensureDbInitialized();
  const rows = await query<any[]>('SELECT id FROM model_configs LIMIT 1');
  if (rows.length > 0) return;

  for (const m of DEFAULT_MODELS) {
    const id = randomUUID();
    await query(
      `INSERT INTO model_configs (id, model_id, display_name, provider, description, is_enabled, default_temperature, default_max_tokens, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        m.model_id,
        m.display_name,
        m.provider,
        m.description,
        m.is_enabled,
        parseFloat(m.default_temperature),
        m.default_max_tokens,
        m.sort_order,
      ]
    );
  }
}
