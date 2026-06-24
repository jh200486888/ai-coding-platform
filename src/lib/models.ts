// AI 模型列表 - 2026年6月最新版本

import type { AIModel, Provider } from '@/types';

// 按厂商分组的最新模型
export const MODELS: AIModel[] = [
  // OpenAI (6个)
  { id: 'gpt-5.6', name: 'GPT-5.6', provider: 'openai', description: '最新旗舰，150万Token上下文' },
  { id: 'gpt-5.6-mini', name: 'GPT-5.6 Mini', provider: 'openai', description: '轻量版，高性价比' },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', description: '上一代旗舰' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', description: '稳定版本' },
  { id: 'o3', name: 'o3', provider: 'openai', description: '推理模型' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', description: '轻量推理模型' },

  // Anthropic (4个)
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'anthropic', description: '最强旗舰模型' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', description: '均衡性能主力' },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'anthropic', description: '快速响应版' },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'anthropic', description: '上一代旗舰' },

  // Google (4个)
  { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro', provider: 'google', description: '最新Pro旗舰' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', description: '极速版 284token/s' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'google', description: '上一代Pro' },
  { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash', provider: 'google', description: '上一代极速版' },

  // DeepSeek (4个)
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', description: '1.6T参数开源旗舰' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', description: '284B参数高效版' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash 2', provider: 'deepseek', description: '代码能力大幅增强' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', description: '推理增强模型' },

  // 智谱 AI (3个)
  { id: 'glm-5.2', name: 'GLM-5.2', provider: 'zhipu', description: '智谱最新旗舰' },
  { id: 'glm-5.1', name: 'GLM-5.1', provider: 'zhipu', description: '上一代旗舰' },
  { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash', provider: 'zhipu', description: '快速版' },

  // 通义千问 (3个)
  { id: 'qwen-max', name: 'Qwen3.5 Max', provider: 'qwen', description: '通义千问旗舰' },
  { id: 'qwen-plus', name: 'Qwen3.5 Plus', provider: 'qwen', description: '增强版' },
  { id: 'qwen-turbo', name: 'Qwen3.5 Turbo', provider: 'qwen', description: '快速版' },

  // Kimi / Moonshot (3个)
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: 'moonshot', description: '代码智能体旗舰' },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', provider: 'moonshot', description: '长文档处理' },
  { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', provider: 'moonshot', description: '经典长上下文' },

  // 百度文心 (2个)
  { id: 'ernie-5.1', name: 'ERNIE 5.1', provider: 'baidu', description: '文心最新版' },
  { id: 'ernie-5.0', name: 'ERNIE 5.0', provider: 'baidu', description: '文心5.0' },

  // 豆包 (2个)
  { id: 'doubao-pro-256k', name: '豆包 Pro 256K', provider: 'doubao', description: '长上下文版' },
  { id: 'doubao-lite-32k', name: '豆包 Lite 32K', provider: 'doubao', description: '轻量版' },

  // Groq (2个)
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'groq', description: 'Meta最新模型' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'groq', description: '轻量版' },

  // Mistral (2个)
  { id: 'mistral-large-2', name: 'Mistral Large 2', provider: 'mistral', description: '旗舰模型' },
  { id: 'mistral-small-3', name: 'Mistral Small 3', provider: 'mistral', description: '轻量版' },

  // xAI (2个)
  { id: 'grok-3', name: 'Grok 3', provider: 'xai', description: 'xAI旗舰' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xai', description: '轻量版' },

  // Cohere (1个)
  { id: 'command-r-plus', name: 'Command R+', provider: 'cohere', description: '企业级模型' },
];

// 厂商名称映射
const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  deepseek: 'DeepSeek',
  zhipu: '智谱 AI',
  qwen: '通义千问',
  moonshot: 'Moonshot AI',
  baidu: '百度文心',
  doubao: '豆包',
  groq: 'Groq',
  mistral: 'Mistral AI',
  xai: 'xAI',
  cohere: 'Cohere',
};

// 按厂商分组
export function getModelsByProvider(): Provider[] {
  const providerMap = new Map<string, AIModel[]>();

  MODELS.forEach(model => {
    if (!providerMap.has(model.provider)) {
      providerMap.set(model.provider, []);
    }
    providerMap.get(model.provider)!.push(model);
  });

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

// 获取厂商列表
export function getProviders(): Provider[] {
  return getModelsByProvider();
}

// 厂商列表（兼容旧代码）
export const PROVIDERS = getProviders();
