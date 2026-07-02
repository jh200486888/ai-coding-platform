/**
 * 视觉代理模块：当非多模态模型（如 DeepSeek）收到图片时，
 * 先调用支持视觉的模型提取图片信息，再将文本传给主模型。
 * 
 * 流程：图片 → 视觉模型(如 qwen-turbo/gpt-4o-mini) → 文本描述 → 主模型
 */

import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';
import { PROVIDER_URLS } from '@/lib/models';
import { logger } from '@/lib/logger';

// 支持视觉输入的模型优先级（从便宜到贵）
// 注意：zhipu API从服务器不可达，放最后
// 视觉模型优先级从DB读取，无配置时用默认值
const DEFAULT_VISION_MODEL_PRIORITY = [
  // ONLY models that actually support vision/image input
  // qwen-turbo/plus/max are TEXT-ONLY, use qwen-vl instead
  // zhipu glm-4-flash is TEXT-ONLY, use glm-4v/glm-5v instead
  { model_id: 'qwen-vl-plus', provider: 'qwen' },
  { model_id: 'qwen-vl-max', provider: 'qwen' },
  { model_id: 'gpt-4o-mini', provider: 'openai' },
  { model_id: 'gpt-4o', provider: 'openai' },
  { model_id: 'gpt-4.1', provider: 'openai' },
  { model_id: 'gemini-2.5-flash', provider: 'google' },
  { model_id: 'glm-5v-turbo', provider: 'zhipu' },
  { model_id: 'glm-4v-plus', provider: 'zhipu' },
  { model_id: 'claude-haiku-4', provider: 'anthropic' },
];

let cachedVisionPriority: any[] | null = null;
let visionCacheExpiry = 0;
const VISION_CACHE_TTL = 5 * 60 * 1000;

async function getVisionModelPriority(): Promise<any[]> {
  if (cachedVisionPriority && Date.now() < visionCacheExpiry) return cachedVisionPriority;
  try {
    const { getSetting } = await import('@/lib/db');
    const val = await getSetting('vision_model_priority');
    if (val) {
      cachedVisionPriority = JSON.parse(val);
      visionCacheExpiry = Date.now() + VISION_CACHE_TTL;
      return cachedVisionPriority!;
    }
  } catch {}
  return DEFAULT_VISION_MODEL_PRIORITY;
}

interface ImageInput {
  base64Data: string;
  mediaType: string; // e.g. 'image/png', 'image/jpeg'
}

// Provider connectivity cache - skip unreachable providers
const UNREACHABLE_PROVIDERS = new Map<string, number>(); // provider -> lastCheckTime
const UNREACHABLE_TTL = 5 * 60 * 1000; // 5 min cache

async function isProviderReachable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(baseUrl.replace(/\/$/, '') + '/models', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true; // Any response means reachable
  } catch {
    return false;
  }
}

/**
 * 查找第一个可用的视觉模型
 */
async function findAvailableVisionModel(): Promise<{
  model_id: string;
  provider: string;
  apiKey: string;
  baseUrl: string | null;
} | null> {
  const visionPriority = await getVisionModelPriority();
  for (const candidate of visionPriority) {
    try {
      // 检查provider是否有API key（不需要model_config，视觉代理模型可能不在用户配置中）
      // const modelConfig = await getModelConfig(candidate.model_id);
      // if (!modelConfig) continue;  // 不再强制要求model_config存在

      // 获取该 provider 的 API key
      const keyInfo = await getApiKeyByProvider(candidate.provider);
      if (!keyInfo || !keyInfo.api_key_encrypted || (keyInfo as any).is_active === false) continue;

      // Skip providers known to be unreachable (cached for 5 min)
      const cachedUnreachable = UNREACHABLE_PROVIDERS.get(candidate.provider);
      if (cachedUnreachable && Date.now() - cachedUnreachable < UNREACHABLE_TTL) {
        logger.info('[VisionProxy] Skipping ' + candidate.provider + ' (unreachable cache)');
        continue;
      }

      // Quick connectivity check
      const testBaseUrl = keyInfo.base_url || PROVIDER_URLS[candidate.provider] || ('https://api.' + candidate.provider + '.com/v1');
      const reachable = await isProviderReachable(testBaseUrl);
      if (!reachable) {
        UNREACHABLE_PROVIDERS.set(candidate.provider, Date.now());
        logger.info('[VisionProxy] ' + candidate.provider + ' unreachable, skipping');
        continue;
      }

      return {
        model_id: candidate.model_id,
        provider: candidate.provider,
        apiKey: Buffer.from(keyInfo.api_key_encrypted, 'base64').toString('utf-8'),
        baseUrl: keyInfo.base_url,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 调用视觉模型提取图片信息
 * @param images 图片列表
 * @param userText 用户的文字描述（可选，帮助视觉模型理解上下文）
 * @returns 图片的文字描述
 */
export async function describeImages(
  images: ImageInput[],
  userText?: string,
): Promise<string> {
  const visionModel = await findAvailableVisionModel();
  if (!visionModel) {
    return '[用户上传了图片，但系统未配置任何支持视觉的模型，无法识别图片内容]';
  }

  console.log('[VisionProxy] Using ' + visionModel.provider + '/' + visionModel.model_id + ' to describe ' + images.length + ' image(s)');

  try {
    const baseUrl = visionModel.baseUrl || PROVIDER_URLS[visionModel.provider] || ('https://api.' + visionModel.provider + '.com/v1');
    const provider = createOpenAICompatible({
      name: visionModel.provider,
      baseURL: baseUrl,
      headers: { Authorization: 'Bearer ' + visionModel.apiKey },
    });
    const model = provider.languageModel(visionModel.model_id);

    // 构建消息：图片 + 提取指令
    const contentParts: any[] = [];

    // 添加所有图片
    for (const img of images) {
      contentParts.push({
        type: 'file',
        data: { type: 'data', data: img.base64Data },
        mediaType: img.mediaType,
      });
    }

    // 添加提取指令
    const instruction = userText
      ? '用户的问题/需求：' + userText + '\n\n请详细描述这张图片的内容，特别注意与用户问题相关的部分。描述需要足够详细，让无法看到图片的人也能完全理解图片内容。'
      : '请详细描述这张图片的内容，包括：1）图片中的主要元素和布局 2）文字内容（如有） 3）颜色、样式等视觉特征 4）如果看起来是截图或UI界面，描述各区域的功能。描述需要足够详细，让无法看到图片的人也能完全理解。';

    contentParts.push({ type: 'text', text: instruction });

    const result = await generateText({
      model,
      messages: [{
        role: 'user',
        content: contentParts,
      }],
      maxOutputTokens: 2000,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(30000),
    });

    const description = result.text || '无法识别图片内容';
    logger.info('[VisionProxy] Description generated: ' + description.slice(0, 100) + '...');
    
    return '[图片内容描述（由' + visionModel.model_id + '识别）]\n' + description;
  } catch (error: any) {
    console.error('[VisionProxy] Failed to describe image: ' + error.message);
    return '[图片识别失败: ' + error.message + '，请基于文字描述回答]';
  }
}

/**
 * 判断模型是否支持多模态输入
 */
export function isMultimodalModel(modelId: string, provider: string): boolean {
  // Model-level multimodal detection - NOT provider-level
  // qwen-turbo/plus/max are TEXT-ONLY, only qwen-vl supports vision
  // zhipu glm-4-flash is TEXT-ONLY, only glm-4v/glm-5v supports vision
  const MULTIMODAL_MODEL_PATTERNS = [
    'gpt-4o', 'gpt-4.1', 'gpt-4-turbo',
    'claude',
    'gemini',
    'qwen-vl', 'qwen2-vl', 'qvq',
    'glm-4v', 'glm-4.5v', 'glm-5v',
  ];
  const TEXT_ONLY_PATTERNS = ['o1-mini', 'o1-preview', 'o3-mini', 'o3', 'deepseek', 'gpt-3.5'];
  return MULTIMODAL_MODEL_PATTERNS.some(p => modelId.toLowerCase().includes(p))
    && !TEXT_ONLY_PATTERNS.some(p => modelId.toLowerCase().includes(p));
}
