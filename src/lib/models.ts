// AI 模型列表 - 2026年6月最新版本

import type { AIModel, Provider } from '@/types';

// 35个最新模型，按厂商分组
export const MODELS: AIModel[] = [
  // DeepSeek (4个)
  { id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'deepseek', description: 'DeepSeek 最新旗舰模型' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', description: '快速响应版本' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', description: '推理增强模型' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', description: '对话模型' },

  // OpenAI (5个)
  { id: 'gpt-5-turbo', name: 'GPT-5 Turbo', provider: 'openai', description: '最新 GPT-5 系列' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', description: 'GPT-5 标准版' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', description: 'GPT-4.1 最新版本' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: 'GPT-4 快速版' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', description: '轻量推理模型' },

  // Anthropic (5个)
  { id: 'claude-5-opus', name: 'Claude 5 Opus', provider: 'anthropic', description: '最强旗舰模型' },
  { id: 'claude-5-sonnet', name: 'Claude 5 Sonnet', provider: 'anthropic', description: '平衡性能' },
  { id: 'claude-4.8-opus', name: 'Claude 4.8 Opus', provider: 'anthropic', description: '上一代旗舰' },
  { id: 'claude-4.8-sonnet', name: 'Claude 4.8 Sonnet', provider: 'anthropic', description: '上一代平衡版' },
  { id: 'claude-4-haiku', name: 'Claude 4 Haiku', provider: 'anthropic', description: '快速响应' },

  // Google (4个)
  { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro', provider: 'google', description: '最新旗舰模型' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', description: '快速版本' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'google', description: '上一代旗舰' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'google', description: '轻量版' },

  // 智谱 AI (3个)
  { id: 'glm-5.2', name: 'GLM-5.2', provider: 'zhipu', description: '最新旗舰' },
  { id: 'glm-5.1', name: 'GLM-5.1', provider: 'zhipu', description: '上一代' },
  { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash', provider: 'zhipu', description: '快速版' },

  // 通义千问 (3个)
  { id: 'qwen-max', name: 'Qwen-Max', provider: 'qwen', description: '最强版本' },
  { id: 'qwen-plus', name: 'Qwen-Plus', provider: 'qwen', description: '平衡版' },
  { id: 'qwen-turbo', name: 'Qwen-Turbo', provider: 'qwen', description: '快速版' },

  // Moonshot (2个)
  { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', provider: 'moonshot', description: '长上下文' },
  { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', provider: 'moonshot', description: '标准版' },

  // 豆包 (2个)
  { id: 'doubao-pro-256k', name: '豆包 Pro 256K', provider: 'doubao', description: '长上下文版' },
  { id: 'doubao-lite-32k', name: '豆包 Lite 32K', provider: 'doubao', description: '轻量版' },

  // Groq (2个)
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'groq', description: 'Meta 最新模型' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'groq', description: '轻量版' },

  // Mistral (2个)
  { id: 'mistral-large-2', name: 'Mistral Large 2', provider: 'mistral', description: '旗舰模型' },
  { id: 'mistral-small-3', name: 'Mistral Small 3', provider: 'mistral', description: '轻量版' },

  // xAI (2个)
  { id: 'grok-3', name: 'Grok 3', provider: 'xai', description: 'xAI 旗舰' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xai', description: '轻量版' },

  // Cohere (1个)
  { id: 'command-r-plus', name: 'Command R+', provider: 'cohere', description: '企业级模型' },
];

// 按厂商分组模型
export function getModelsByProvider(): Provider[] {
  const providerMap = new Map<string, AIModel[]>();

  MODELS.forEach(model => {
    if (!providerMap.has(model.provider)) {
      providerMap.set(model.provider, []);
    }
    providerMap.get(model.provider)!.push(model);
  });

  const providerNames: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google AI',
    zhipu: '智谱 AI',
    qwen: '通义千问',
    moonshot: 'Moonshot AI',
    doubao: '豆包',
    groq: 'Groq',
    mistral: 'Mistral AI',
    xai: 'xAI',
    cohere: 'Cohere',
  };

  return Array.from(providerMap.entries()).map(([id, models]) => ({
    id,
    name: providerNames[id] || id,
    models,
  }));
}

// 获取所有模型
export function getAllModels(): AIModel[] {
  return MODELS;
}

// 根据 ID 获取模型
export function getModelById(modelId: string): AIModel | undefined {
  return MODELS.find(m => m.id === modelId);
}

// 根据厂商获取模型
export function getModelsByProviderId(providerId: string): AIModel[] {
  return MODELS.filter(m => m.provider === providerId);
}

// 厂商列表（兼容旧代码）
export const PROVIDERS = getProviders();
