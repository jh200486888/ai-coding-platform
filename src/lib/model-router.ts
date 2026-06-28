import { getApiKeyByProvider, getModelConfig, getSetting, query } from '@/lib/db';

// ============ Intent Classification ============
const DESIGN_KEYWORDS = ['设计', '海报', 'logo', '封面', 'UI', '界面', '配色', '排版', '布局', '图片', '图标', '插画', 'design', 'poster', 'banner', 'thumbnail'];
const CODE_KEYWORDS = ['代码', '函数', 'API', '数据库', '部署', 'debug', '修复', '编程', 'code', 'function', 'api', 'deploy', 'bug', 'fix'];
const IMAGE_KEYWORDS = ['生成图', '画图', '生图', '画一个', 'generate image', 'draw', 'create image'];

export type IntentType = 'design' | 'code' | 'image' | 'chat';

export function classifyIntent(message: string): IntentType {
  const lower = message.toLowerCase();
  
  if (IMAGE_KEYWORDS.some(kw => lower.includes(kw))) return 'image';
  if (DESIGN_KEYWORDS.some(kw => lower.includes(kw))) return 'design';
  if (CODE_KEYWORDS.some(kw => lower.includes(kw))) return 'code';
  return 'chat';
}

// ============ Model Capability Mapping ============
// Each intent maps to preferred providers in priority order
const INTENT_MODEL_MAP: Record<IntentType, { provider: string; model: string }[]> = {
  design: [
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'zhipu', model: 'glm-4-plus' },
    { provider: 'qwen', model: 'qwen-max' },
    { provider: 'openai', model: 'gpt-4o' },
  ],
  code: [
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'zhipu', model: 'glm-4-plus' },
  ],
  image: [
    { provider: 'openai-image', model: 'dall-e-3' },
  ],
  chat: [
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'zhipu', model: 'glm-4-plus' },
    { provider: 'qwen', model: 'qwen-max' },
  ],
};

// ============ Smart Model Router ============
export interface ModelRouteResult {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  intent: IntentType;
  routingReason: string;
}

export async function routeModel(message: string, forceIntent?: IntentType): Promise<ModelRouteResult | null> {
  // 1. Classify intent
  const intent = forceIntent || classifyIntent(message);
  
  // 2. Check for design-specific model override in settings
  try {
    const designModel = await getSetting('design_model');
    if (designModel && intent === 'design') {
      const config = await getModelConfig(designModel);
      if (config) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return {
            provider: config.provider,
            model: designModel,
            apiKey: keyData.api_key_encrypted,
            baseUrl: keyData.base_url,
            intent,
            routingReason: `设计专用模型: ${designModel}`,
          };
        }
      }
    }
  } catch {}

  // 3. Try intent-preferred models in order
  const preferredModels = INTENT_MODEL_MAP[intent];
  for (const preferred of preferredModels) {
    try {
      const keyData = await getApiKeyByProvider(preferred.provider);
      if (keyData?.api_key_encrypted) {
        return {
          provider: preferred.provider,
          model: preferred.model,
          apiKey: keyData.api_key_encrypted,
          baseUrl: keyData.base_url,
          intent,
          routingReason: `意图[${intent}] → ${preferred.provider}/${preferred.model}`,
        };
      }
    } catch {}
  }

  // 4. Fallback: try default model from settings
  try {
    const defaultModel = await getSetting('default_model');
    if (defaultModel) {
      const config = await getModelConfig(defaultModel);
      if (config) {
        const keyData = await getApiKeyByProvider(config.provider);
        if (keyData?.api_key_encrypted) {
          return {
            provider: config.provider,
            model: defaultModel,
            apiKey: keyData.api_key_encrypted,
            baseUrl: keyData.base_url,
            intent,
            routingReason: `默认模型: ${defaultModel}`,
          };
        }
      }
    }
  } catch {}

  // 5. Last resort: try any available provider
  for (const fallbackProvider of ['deepseek', 'zhipu', 'qwen', 'openai', 'moonshot', 'doubao']) {
    try {
      const keyData = await getApiKeyByProvider(fallbackProvider);
      if (keyData?.api_key_encrypted) {
        return {
          provider: fallbackProvider,
          model: 'auto',
          apiKey: keyData.api_key_encrypted,
          baseUrl: keyData.base_url,
          intent,
          routingReason: `兜底: ${fallbackProvider}`,
        };
      }
    } catch {}
  }

  return null;
}
