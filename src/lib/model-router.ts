import { getApiKeyByProvider, getModelConfig, getSetting, query } from '@/lib/db';

export type IntentType = 'design' | 'code' | 'image' | 'chat';

export function classifyIntent(message: string): IntentType {
  const lower = message.toLowerCase();
  if (['生成图','画图','生图','generate image','draw','create image'].some(kw => lower.includes(kw))) return 'image';
  if (['设计','海报','logo','封面','UI','界面','配色','排版','布局','design','poster','banner'].some(kw => lower.includes(kw))) return 'design';
  if (['代码','函数','API','数据库','部署','debug','修复','编程','code','function','deploy','bug'].some(kw => lower.includes(kw))) return 'code';
  return 'chat';
}

const INTENT_PROVIDER_PRIORITY: Record<IntentType, string[]> = {
  design: ['deepseek', 'zhipu', 'qwen', 'openai'],
  code: ['deepseek', 'zhipu', 'openai'],
  image: ['openai-image'],
  chat: ['deepseek', 'zhipu', 'qwen'],
};

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
  
  // 1. Check for intent-specific model override in settings
  try {
    const settingKey = `${intent}_model`;
    const overrideModel = await getSetting(settingKey);
    if (overrideModel) {
      const config = await getModelConfig(overrideModel);
      if (config) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return { provider: config.provider, model: overrideModel,
            apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
            intent, routingReason: `${intent} model: ${overrideModel}` };
        }
      }
    }
  } catch {}

  // 2. Try intent-preferred providers, resolving model ID from DB model_configs
  const providers = INTENT_PROVIDER_PRIORITY[intent];
  for (const provider of providers) {
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

  // 3. Fallback: default model from settings
  try {
    const defaultModel = await getSetting('default_model');
    if (defaultModel) {
      const config = await getModelConfig(defaultModel);
      if (config) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return { provider: config.provider, model: defaultModel,
            apiKey: decodeApiKey(keyData.api_key_encrypted), baseUrl: keyData.base_url,
            intent, routingReason: `default: ${defaultModel}` };
        }
      }
    }
  } catch {}

  // 4. Last resort: any available provider
  for (const fb of ['deepseek', 'zhipu', 'qwen', 'openai', 'moonshot', 'doubao']) {
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
