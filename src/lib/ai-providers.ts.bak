// AI 提供商配置

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyPrefix?: string;
}

// 支持的 AI 提供商列表（去除 dashscope/volcengine 重复项）
export const PROVIDERS: Record<string, ProviderConfig> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.cn/v1',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  doubao: {
    id: 'doubao',
    name: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
  },
  baidu: {
    id: 'baidu',
    name: '百度文心',
    baseUrl: 'https://qianfan.baidubce.com/v2',
  },
};

// Provider 别名映射：前端模型 provider → 数据库可能存储的 provider
export const PROVIDER_ALIASES: Record<string, string[]> = {
  qwen: ['dashscope'],
  doubao: ['volcengine'],
};

// 获取提供商配置
export function getProviderConfig(providerId: string): ProviderConfig | null {
  return PROVIDERS[providerId] || null;
}

// 获取所有提供商
export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

// 使用 OpenAI 兼容 Chat Completions 的厂商列表
const OPENAI_COMPAT_PROVIDERS = new Set([
  'deepseek', 'dashscope', 'zhipu', 'moonshot', 'yi',
  'minimax', 'doubao', 'qianfan', 'hunyuan', 'openrouter',
  'together', 'groq', 'mistral', 'xai', 'baidu', 'qwen',
  'volcengine', 'cohere',
]);

// 根据提供商获取模型配置（用于 AI SDK）
export function getModelByProvider(providerId: string, modelId: string, apiKey: string) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  if (OPENAI_COMPAT_PROVIDERS.has(providerId)) {
    // 使用 OpenAI 兼容接口，强制走 chat completions API
    const { createOpenAI } = require('@ai-sdk/openai');
    const openai = createOpenAI({
      apiKey,
      baseURL: provider.baseUrl,
    });
    // 用 .chat() 强制走 /chat/completions 而非 /responses
    return openai.chat(modelId);
  }

  switch (providerId) {
    case 'openai': {
      const { createOpenAI } = require('@ai-sdk/openai');
      const openai = createOpenAI({
        apiKey,
        baseURL: provider.baseUrl,
      });
      // OpenAI 官方可以用 responses API
      return openai(modelId);
    }
    case 'anthropic': {
      const { createAnthropic } = require('@ai-sdk/anthropic');
      return createAnthropic({ apiKey })(modelId);
    }
    case 'google': {
      const { createGoogleGenerativeAI } = require('@ai-sdk/google');
      return createGoogleGenerativeAI({ apiKey })(modelId);
    }
    default:
      throw new Error(`Provider ${providerId} not supported`);
  }
}

// 解码 Base64 编码的 API Key
export function decodeApiKey(encodedKey: string): string {
  try {
    return Buffer.from(encodedKey, 'base64').toString('utf-8');
  } catch {
    return encodedKey;
  }
}

// 编码 API Key 为 Base64
export function encodeApiKey(apiKey: string): string {
  return Buffer.from(apiKey).toString('base64');
}
