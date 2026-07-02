import { getApiKeyByProvider, getModelConfig, getSetting, query } from '@/lib/db';
import { logger } from '@/lib/logger';

export type IntentType = 'design' | 'code' | 'image' | 'visual' | 'chat' | 'coding' | 'analysis' | 'writing';

export function classifyIntent(message: string): IntentType {
  const lower = message.toLowerCase();
  if (['生成图','画图','生图','generate image','draw','create image'].some(kw => lower.includes(kw))) return 'image';
  if (['截图','设计稿','复刻','前端复刻','视觉编程','screenshot','mockup','wireframe','设计图','UI还原','界面还原','界面复刻'].some(kw => lower.includes(kw))) return 'visual';
  if (['设计','海报','logo','封面','UI','界面','配色','排版','布局','design','poster','banner'].some(kw => lower.includes(kw))) return 'design';
  if (['分析','评估','比较','优化','审查','analyze','evaluate','compare','optimize','review','评估报告','数据分析'].some(kw => lower.includes(kw))) return 'analysis';
  if (['写','文案','文章','总结','翻译','写作','write','article','summary','translate','draft','文案写作','报告'].some(kw => lower.includes(kw))) return 'writing';
  if (['代码','函数','API','数据库','部署','debug','修复','编程','code','function','deploy','bug','重构','implement','开发','建站','网站','应用'].some(kw => lower.includes(kw))) return 'coding';
  if (['代码','函数','API','数据库','部署','debug','修复','编程','code','function','deploy','bug'].some(kw => lower.includes(kw))) return 'code';
  return 'chat';
}

// === Provider优先级从DB读取 ===
const DEFAULT_INTENT_PROVIDER_PRIORITY: Record<string, string[]> = {
  design: ['openai', 'anthropic', 'deepseek', 'qwen', 'zhipu'],
  visual: ['openai', 'anthropic', 'zhipu', 'deepseek', 'qwen'],
  code: ['openai', 'anthropic', 'deepseek', 'qwen', 'zhipu'],
  coding: ['openai', 'anthropic', 'deepseek', 'qwen', 'zhipu'],
  analysis: ['openai', 'anthropic', 'deepseek', 'qwen', 'zhipu'],
  writing: ['openai', 'deepseek', 'qwen', 'anthropic', 'zhipu'],
  image: ['openai-image'],
  chat: ['deepseek', 'qwen', 'zhipu', 'openai'],
};

let cachedProviderPriority: Record<string, string[]> | null = null;
let providerCacheExpiry = 0;

async function getIntentProviderPriority(): Promise<Record<string, string[]>> {
  if (cachedProviderPriority && Date.now() < providerCacheExpiry) return cachedProviderPriority;
  try {
    const val = await getSetting('intent_provider_priority');
    if (val) {
      cachedProviderPriority = JSON.parse(val);
      providerCacheExpiry = Date.now() + CACHE_TTL;
      return cachedProviderPriority!;
    }
  } catch {}
  return DEFAULT_INTENT_PROVIDER_PRIORITY;
}

// === 智能模型路由：从DB读取，DB无配置时用默认值 ===
const DEFAULT_INTENT_MODEL_PRIORITY: Record<string, string[]> = {
  code: ['gpt-4.1', 'claude-sonnet-4-5', 'deepseek-v4-pro', 'deepseek-v4-flash', 'o3-mini', 'qwen-max'],
  coding: ['gpt-5.5-thinking', 'gpt-5.4-thinking', 'gpt-4.1', 'deepseek-v4-pro', 'claude-sonnet-4-5'],
  analysis: ['gpt-5.5-thinking', 'gpt-5.4-thinking', 'deepseek-v4-pro', 'claude-sonnet-4-5'],
  writing: ['gpt-5.5', 'gpt-5.4-mini', 'qwen-max', 'deepseek-v4-flash'],
  design: ['gpt-4.1', 'claude-sonnet-4-5', 'deepseek-v4-flash', 'qwen-max'],
  visual: ['gpt-4.1', 'claude-sonnet-4-5', 'glm-5v-turbo', 'deepseek-v4-flash'],
  chat: ['deepseek-v4-flash', 'gpt-4o-mini', 'qwen-turbo', 'glm-4-flash'],
  image: ['gpt-image-2'],
};

// Cache for DB-loaded model priorities
let cachedModelPriority: Record<string, string[]> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getIntentModelPriority(): Promise<Record<string, string[]>> {
  if (cachedModelPriority && Date.now() < cacheExpiry) return cachedModelPriority;
  try {
    const val = await getSetting('intent_model_priority');
    if (val) {
      cachedModelPriority = JSON.parse(val);
      cacheExpiry = Date.now() + CACHE_TTL;
      return cachedModelPriority!;
    }
  } catch {}
  return DEFAULT_INTENT_MODEL_PRIORITY;
}

export interface ModelRouteResult {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  intent: IntentType;
  routingReason: string;
}

function decodeApiKey(encoded: string): string {
  try { return Buffer.from(encoded, 'base64').toString('utf-8'); }
  catch { return encoded; }
}

// === Failed Provider Cache ===
// Temporarily marks providers as unavailable after API errors (balance/quota/429)
const failedProviders = new Map<string, number>(); // provider -> retryAfter timestamp
const FAIL_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown

/** Mark a provider as failed (called by chat route when API returns balance/quota errors) */
export function markProviderFailed(provider: string, reason?: string) {
  failedProviders.set(provider, Date.now() + FAIL_COOLDOWN_MS);
  logger.info(`[Router] Provider ${provider} marked as failed: ${reason || 'API error'}, will retry after ${FAIL_COOLDOWN_MS/60000}min`);
}

/** Check if a provider is currently in cooldown */
function isProviderAvailable(provider: string): boolean {
  const retryAfter = failedProviders.get(provider);
  if (!retryAfter) return true;
  if (Date.now() >= retryAfter) {
    failedProviders.delete(provider);
    return true;
  }
  return false;
}

// Get the best model ID for a provider from model_configs
async function getBestModelForProvider(provider: string): Promise<string | null> {
  try {
    const models = await query<{ modelId: string }>(
      'SELECT "modelId" FROM model_configs WHERE provider = $1 AND "isActive" = true ORDER BY "sortOrder" LIMIT 1', [provider]
    );
    return models?.[0]?.modelId || null;
  } catch { return null; }
}

export async function routeModel(message: string, forceIntent?: IntentType): Promise<ModelRouteResult | null> {
  const intent = forceIntent || classifyIntent(message);
  
  // 1. Check for intent-specific model override in settings (but skip failed providers)
  try {
    const settingKey = `${intent}_model`;
    const overrideModel = await getSetting(settingKey);
    if (overrideModel) {
      const config = await getModelConfig(overrideModel);
      if (config && isProviderAvailable(config.provider)) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return { provider: config.provider, model: overrideModel,
            apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
            intent, routingReason: `${intent} model: ${overrideModel}` };
        }
      }
    }
  } catch {}

  // 2. Try intent-preferred specific models first (smart routing, DB-driven)
  const modelPriority = await getIntentModelPriority();
  const preferredModels = modelPriority[intent] || [];
  for (const modelId of preferredModels) {
    try {
      const config = await getModelConfig(modelId);
      if (config && isProviderAvailable(config.provider)) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return { provider: config.provider, model: modelId,
            apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
            intent, routingReason: `smart_route[${intent}] -> ${config.provider}/${modelId}` };
        }
      }
    } catch {}
  }

  // 3. Try intent-preferred providers (fallback to any active model)
  const providerPriority = await getIntentProviderPriority();
  const providers = providerPriority[intent] || [];
  for (const provider of providers) {
    if (!isProviderAvailable(provider)) {
      logger.info(`[Router] Skipping ${provider} (in cooldown)`);
      continue;
    }
    try {
      const keyData = await getApiKeyByProvider(provider);
      if (keyData?.api_key_encrypted) {
        const modelId = await getBestModelForProvider(provider);
        if (modelId) {
          return { provider, model: modelId,
            apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
            intent, routingReason: `intent[${intent}] -> ${provider}/${modelId}` };
        }
      }
    } catch {}
  }

  // 4. Fallback: default model from settings
  try {
    const defaultModel = await getSetting('default_model');
    if (defaultModel) {
      const config = await getModelConfig(defaultModel);
      if (config && isProviderAvailable(config.provider)) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return { provider: config.provider, model: defaultModel,
            apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
            intent, routingReason: `default: ${defaultModel}` };
        }
      }
    }
  } catch {}

  // 5. Last resort: any available provider (skip failed ones)
  // Fallback provider list from DB setting, default to common providers
  const fallbackProviders = (await getSetting('fallback_providers'))?.split(',').map((s:string)=>s.trim()).filter(Boolean) || ['deepseek', 'zhipu', 'qwen', 'openai', 'moonshot', 'doubao'];
  for (const fb of fallbackProviders) {
    if (!isProviderAvailable(fb)) continue;
    try {
      const keyData = await getApiKeyByProvider(fb);
      if (keyData?.api_key_encrypted) {
        const modelId = await getBestModelForProvider(fb);
        return { provider: fb, model: modelId || 'auto',
          apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
          intent, routingReason: `fallback: ${fb}/${modelId || 'auto'}` };
      }
    } catch {}
  }

  return null;
}
