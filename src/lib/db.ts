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
  // ============ 国内大模型（2025最新） ============
  // 字节跳动 - 豆包
  { model_id: 'doubao-seed-2-0-pro-260215', display_name: '豆包 Seed 2.0 Pro', provider: 'doubao', description: '旗舰级全能通用模型，复杂推理与长链路任务', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 1 },
  { model_id: 'doubao-seed-2-0-lite-260215', display_name: '豆包 Seed 2.0 Lite', provider: 'doubao', description: '均衡型模型，性能与成本兼顾', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 2 },
  { model_id: 'doubao-seed-2-0-mini-260215', display_name: '豆包 Seed 2.0 Mini', provider: 'doubao', description: '低时延高并发，256K上下文', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 3 },
  
  // 深度求索 - DeepSeek
  { model_id: 'deepseek-v3-2-251201', display_name: 'DeepSeek V3.2', provider: 'deepseek', description: '最新旗舰模型，推理能力与输出长度平衡', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 4 },
  { model_id: 'deepseek-r1-250120', display_name: 'DeepSeek R1', provider: 'deepseek', description: '深度推理模型，复杂问题解决', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 5 },
  
  // 月之暗面 - Kimi
  { model_id: 'kimi-k2-5-260127', display_name: 'Kimi K2.5', provider: 'kimi', description: '迄今最智能模型，原生多模态架构', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 6 },
  
  // 智谱 - GLM
  { model_id: 'glm-5-0-260211', display_name: 'GLM-5.0', provider: 'zhipu', description: '新一代旗舰基座，复杂系统工程', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 7 },
  { model_id: 'glm-5-turbo-260316', display_name: 'GLM-5 Turbo', provider: 'zhipu', description: '深度优化基座模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 8 },
  { model_id: 'glm-4-7-251222', display_name: 'GLM-4.7', provider: 'zhipu', description: '更强编程能力与推理', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 9 },
  
  // 通义千问 - Qwen
  { model_id: 'qwen-3-5-plus-260215', display_name: '通义千问 3.5 Plus', provider: 'qwen', description: '原生视觉语言Plus模型，混合架构', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 10 },
  { model_id: 'qwen-3-5-max-260215', display_name: '通义千问 3.5 Max', provider: 'qwen', description: '旗舰模型，最强性能', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 11 },
  
  // 百度 - 文心一言
  { model_id: 'ernie-4-5-turbo', display_name: '文心一言 4.5 Turbo', provider: 'baidu', description: '百度最新旗舰模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 12 },
  { model_id: 'ernie-4-5', display_name: '文心一言 4.5', provider: 'baidu', description: '旗舰版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 13 },
  
  // 讯飞 - 星火
  { model_id: 'spark-4-0-ultra', display_name: '讯飞星火 4.0 Ultra', provider: 'spark', description: '讯飞最新旗舰模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 14 },
  { model_id: 'spark-4-0', display_name: '讯飞星火 4.0', provider: 'spark', description: '4.0版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 15 },
  
  // MiniMax
  { model_id: 'minimax-m2-5-260212', display_name: 'MiniMax M2.5', provider: 'minimax', description: '编码与智能体领域SOTA', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 16 },
  { model_id: 'minimax-m2-7-260318', display_name: 'MiniMax M2.7', provider: 'minimax', description: '复杂Agent任务', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 17 },
  
  // 零一万物 - Yi
  { model_id: 'yi-lightning', display_name: 'Yi-Lightning', provider: 'yi', description: '零一万物最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 18 },
  
  // ============ 国外大模型（2025最新） ============
  // OpenAI
  { model_id: 'gpt-4o-2024-11-20', display_name: 'GPT-4o', provider: 'openai', description: 'OpenAI 最新旗舰，多模态', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 30 },
  { model_id: 'gpt-4o-mini-2024-07-18', display_name: 'GPT-4o Mini', provider: 'openai', description: '高性价比版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 31 },
  { model_id: 'gpt-4-5-2024-08-06', display_name: 'GPT-4.5', provider: 'openai', description: 'GPT-4.5最新版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 32 },
  { model_id: 'o1-2024-12-17', display_name: 'OpenAI o1', provider: 'openai', description: '推理模型，复杂任务', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 33 },
  { model_id: 'o1-mini-2024-09-12', display_name: 'OpenAI o1-mini', provider: 'openai', description: '轻量推理模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 34 },
  
  // Anthropic - Claude
  { model_id: 'claude-4-opus-20250514', display_name: 'Claude 4 Opus', provider: 'anthropic', description: 'Anthropic 最强模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 40 },
  { model_id: 'claude-4-sonnet-20250514', display_name: 'Claude 4 Sonnet', provider: 'anthropic', description: '性能均衡', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 41 },
  { model_id: 'claude-3-7-sonnet-20250219', display_name: 'Claude 3.7 Sonnet', provider: 'anthropic', description: '3.7代旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 42 },
  { model_id: 'claude-3-5-sonnet-20241022', display_name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: '上一代旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 43 },
  { model_id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku', provider: 'anthropic', description: '快速响应版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 44 },
  
  // Google - Gemini
  { model_id: 'gemini-2-5-pro-preview-05-06', display_name: 'Gemini 2.5 Pro', provider: 'google', description: 'Google 最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 50 },
  { model_id: 'gemini-2-0-flash-001', display_name: 'Gemini 2.0 Flash', provider: 'google', description: '快速响应版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 51 },
  { model_id: 'gemini-2-0-flash-lite-001', display_name: 'Gemini 2.0 Flash Lite', provider: 'google', description: '轻量版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 8192, sort_order: 52 },
  
  // Meta - Llama
  { model_id: 'llama-3-3-70b-instruct', display_name: 'Llama 3.3 70B', provider: 'meta', description: 'Meta 最新开源模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 60 },
  { model_id: 'llama-3-1-405b-instruct', display_name: 'Llama 3.1 405B', provider: 'meta', description: '最大开源模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 61 },
  
  // Mistral
  { model_id: 'mistral-large-2411', display_name: 'Mistral Large 2', provider: 'mistral', description: 'Mistral 最新旗舰', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 70 },
  { model_id: 'mistral-small-2409', display_name: 'Mistral Small', provider: 'mistral', description: '轻量版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 71 },
  
  // Cohere
  { model_id: 'command-r-plus-08-2024', display_name: 'Command R+', provider: 'cohere', description: 'Cohere 旗舰模型', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 80 },
  { model_id: 'command-r-08-2024', display_name: 'Command R', provider: 'cohere', description: 'RAG优化版本', is_enabled: 1, default_temperature: '0.7', default_max_tokens: 4096, sort_order: 81 },
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
