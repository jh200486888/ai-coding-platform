/**
 * 视觉代理模块：当非多模态模型（如 DeepSeek）收到图片时，
 * 先调用支持视觉的模型提取图片信息，再将文本传给主模型。
 * 
 * 流程：图片 → 视觉模型(如 gpt-4o-mini/glm-4-flash) → 文本描述 → 主模型
 */

import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';

// 支持视觉输入的模型优先级（从便宜到贵）
const VISION_MODEL_PRIORITY = [
  { model_id: 'glm-5v-turbo', provider: 'zhipu' },
  { model_id: 'glm-4-flash', provider: 'zhipu' },
  { model_id: 'qwen-turbo', provider: 'qwen' },
  { model_id: 'gpt-4o-mini', provider: 'openai' },
  { model_id: 'glm-4.5-flash', provider: 'zhipu' },
  { model_id: 'qwen-plus', provider: 'qwen' },
  { model_id: 'gpt-4o', provider: 'openai' },
  { model_id: 'gpt-4.1', provider: 'openai' },
  { model_id: 'qwen-max', provider: 'qwen' },
  { model_id: 'gemini-2.5-flash', provider: 'google' },
  { model_id: 'claude-haiku-4', provider: 'anthropic' },
];

interface ImageInput {
  base64Data: string;
  mediaType: string; // e.g. 'image/png', 'image/jpeg'
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
  for (const candidate of VISION_MODEL_PRIORITY) {
    try {
      // 检查模型是否在数据库中配置且激活
      const modelConfig = await getModelConfig(candidate.model_id);
      if (!modelConfig) continue;

      // 获取该 provider 的 API key
      const keyInfo = await getApiKeyByProvider(candidate.provider);
      if (!keyInfo || !keyInfo.api_key_encrypted || keyInfo.is_active !== 1) continue;

      return {
        model_id: candidate.model_id,
        provider: candidate.provider,
        apiKey: keyInfo.api_key_encrypted,
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

  console.log(`[VisionProxy] Using ${visionModel.provider}/${visionModel.model_id} to describe ${images.length} image(s)`);

  try {
    const baseUrl = visionModel.baseUrl || `https://api.${visionModel.provider}.com/v1`;
    const provider = createOpenAICompatible({
      name: visionModel.provider,
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${visionModel.apiKey}` },
    });
    const model = provider.languageModel(visionModel.model_id);

    // 构建消息：图片 + 提取指令
    const contentParts: Array<{ type: "text"; text: string } | { type: "file"; data: string; mediaType: string }> = [];

    // 添加所有图片
    for (const img of images) {
      contentParts.push({
        type: 'file',
        data: img.base64Data,
        mediaType: img.mediaType,
      });
    }

    // 添加提取指令
    const instruction = userText
      ? `用户的问题/需求：${userText}\n\n请详细描述这张图片的内容，特别注意与用户问题相关的部分。描述需要足够详细，让无法看到图片的人也能完全理解图片内容。`
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
    });

    const description = result.text || '无法识别图片内容';
    console.log(`[VisionProxy] Description generated: ${description.slice(0, 100)}...`);
    
    return `[图片内容描述（由${visionModel.model_id}识别）]\n${description}`;
  } catch (error: any) {
    console.error(`[VisionProxy] Failed to describe image: ${error.message}`);
    return `[图片识别失败: ${error.message}，请基于文字描述回答]`;
  }
}

/**
 * 判断模型是否支持多模态输入
 */
export function isMultimodalModel(modelId: string, provider: string): boolean {
  const MULTIMODAL_PROVIDERS = ['openai', 'anthropic', 'google', 'qwen', 'zhipu'];
  const MULTIMODAL_KEYWORDS = ['gpt-4o', 'gpt-4.1', 'claude', 'gemini', 'qwen-vl', 'glm-4', 'glm-5'];
  
  if (MULTIMODAL_PROVIDERS.includes(provider)) {
    // 这些 provider 大部分模型支持，但排除纯文本的
    const textOnly = ['o3-mini', 'o3', 'deepseek'];
    if (textOnly.some(k => modelId.includes(k))) return false;
    return true;
  }
  return MULTIMODAL_KEYWORDS.some(k => modelId.toLowerCase().includes(k));
}
