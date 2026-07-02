import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { decodeApiKey, PROVIDER_ALIASES } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

// Increase body size limit for large reference images (base64 can be >10MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

// Model configurations - interface
interface ModelConfig {
  provider: 'openai' | 'qwen' | 'volcengine' | 'zhipu' | 'agnes';
  sizes: Record<string, string[]>;
  defaultSize: string;
  maxN: number;
  supportsEdit: boolean;
  dashScopeModel?: string;
  editModel?: string;
  apiType?: 'text2image' | 'multimodal' | 'openai-edit';
}

// Hardcoded fallback configs (used when DB is unavailable)
const FALLBACK_MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-image-2': {
    provider: 'openai',
    sizes: { '1k': ['1024x1024', '1536x1024', '1024x1536'], '2k': ['2048x2048', '2048x1536', '1536x2048', '2048x1152', '1152x2048'] },
    defaultSize: '1024x1024', maxN: 10, supportsEdit: true, apiType: 'openai-edit',
  },
  'qwen-image-2.0': {
    provider: 'qwen', dashScopeModel: 'wanx2.1-t2i-turbo',
    sizes: { '1k': ['1024*1024', '720*1280', '1280*720'] },
    defaultSize: '1024*1024', maxN: 4, supportsEdit: true, apiType: 'text2image',
  },
  'qwen-image-2.0-pro': {
    provider: 'qwen', dashScopeModel: 'wanx2.1-t2i-plus',
    sizes: { '1k': ['1024*1024', '720*1280', '1280*720'], '2k': ['2048*2048', '1440*2560', '2560*1440'] },
    defaultSize: '1024*1024', maxN: 4, supportsEdit: true, apiType: 'text2image',
  },
  'wan2.6-t2i': {
    provider: 'qwen', dashScopeModel: 'wanx-v1',
    sizes: { '1k': ['1024*1024', '720*1280', '1280*720', '768*1152', '1152*768'], '2k': ['1440*1440', '1024*1440', '1440*1024'] },
    defaultSize: '1024*1024', maxN: 4, supportsEdit: true, apiType: 'text2image',
  },
  'wanx-v1-edit': {
    provider: 'qwen', dashScopeModel: 'wanx-v1',
    sizes: { '1k': ['1024*1024', '720*1280', '1280*720'] },
    defaultSize: '1024*1024', maxN: 4, supportsEdit: true, apiType: 'text2image',
  },
  'SeedDream-3.0': {
    provider: 'volcengine',
    sizes: { '1k': ['1024x1024', '768x1024', '1024x768', '576x1024', '1024x576'], '2k': ['2048x2048', '1536x2048', '2048x1536'] },
    defaultSize: '1024x1024', maxN: 4, supportsEdit: false, apiType: 'openai-edit',
  },
  'agnes-image-2.0-flash': {
    provider: 'agnes',
    sizes: { '1k': ['1024x1024', '1024x768', '768x1024'], '2k': ['2048x2048', '2048x1536', '1536x2048'] },
    defaultSize: '1024x1024', maxN: 4, supportsEdit: true, apiType: 'openai-edit',
  },
  'agnes-image-2.1-flash': {
    provider: 'agnes',
    sizes: { '1k': ['1024x1024', '1536x1024', '1024x1536', '768x1024', '1024x768'], '2k': ['2048x2048', '2048x1536', '1536x2048'], '3k': ['3072x3072', '3072x2304', '2304x3072'], '4k': ['4096x4096', '4096x3072', '3072x4096'] },
    defaultSize: '1024x1024', maxN: 4, supportsEdit: true, apiType: 'openai-edit',
  },

};

// Cache for DB-loaded configs (refreshed every 5 minutes)
let cachedModelConfigs: Record<string, ModelConfig> | null = null;
let lastConfigLoad = 0;
const CONFIG_CACHE_MS = 5 * 60 * 1000;

async function loadModelConfigs(): Promise<Record<string, ModelConfig>> {
  const now = Date.now();
  if (cachedModelConfigs && now - lastConfigLoad < CONFIG_CACHE_MS) {
    return cachedModelConfigs;
  }

  try {
    const rows = await query(
      'SELECT "modelId", "image_config", "isActive" FROM model_configs WHERE "image_config" IS NOT NULL'
    );
    
    if (rows && rows.length > 0) {
      const configs: Record<string, ModelConfig> = {};
      for (const row of rows) {
        if (row.isActive && row.image_config) {
          try {
            const config = typeof row.image_config === 'string' 
              ? JSON.parse(row.image_config) 
              : row.image_config;
            configs[row.modelId] = config as ModelConfig;
          } catch {}
        }
      }
      // Merge with fallback for any models not in DB
      for (const [id, config] of Object.entries(FALLBACK_MODEL_CONFIGS)) {
        if (!configs[id]) configs[id] = config;
      }
      cachedModelConfigs = configs;
      lastConfigLoad = now;
      return configs;
    }
  } catch (error) {
    console.error('Failed to load model configs from DB, using fallback:', error);
  }

  return FALLBACK_MODEL_CONFIGS;
}

function resolveOpenAISize(model: string, ratio: string, resolution: string, configs: Record<string, ModelConfig>): string {
  const config = configs[model];
  if (!config) return '1024x1024';
  const resKey = resolution === '2k' || resolution === '4k' ? '2k' : '1k';
  const sizes = config.sizes[resKey] || config.sizes['1k'] || ['1024x1024'];
  const ratioToSize: Record<string, string> = {
    '1:1': sizes.find(s => s.includes('1024') && s.includes('1024')) || sizes[0],
    '3:4': sizes.find(s => { const [w, h] = s.split(/[x*]/); return parseInt(w) < parseInt(h); }) || sizes[0],
    '4:3': sizes.find(s => { const [w, h] = s.split(/[x*]/); return parseInt(w) > parseInt(h) && parseInt(w) < 1500; }) || sizes[0],
    '16:9': sizes.find(s => { const [w, h] = s.split(/[x*]/); return parseInt(w) > parseInt(h) * 1.5; }) || sizes[0],
    '9:16': sizes.find(s => { const [w, h] = s.split(/[x*]/); return parseInt(h) > parseInt(w) * 1.5; }) || sizes[0],
  };
  return ratioToSize[ratio] || config.defaultSize;
}

function resolveDashScopeSize(model: string, ratio: string, resolution: string, configs: Record<string, ModelConfig>): string {
  const config = configs[model];
  if (!config) return '1024*1024';
  const resKey = resolution === '2k' || resolution === '4k' ? '2k' : '1k';
  const sizes = config.sizes[resKey] || config.sizes['1k'] || ['1024*1024'];
  const ratioToSize: Record<string, string> = {
    '1:1': sizes.find(s => s.includes('1024*1024') || s.includes('1280*1280') || s.includes('1440*1440')) || sizes[0],
    '3:4': sizes.find(s => { const [w, h] = s.split('*'); return parseInt(w) < parseInt(h); }) || sizes[0],
    '4:3': sizes.find(s => { const [w, h] = s.split('*'); return parseInt(w) > parseInt(h); }) || sizes[0],
    '16:9': sizes.find(s => { const [w, h] = s.split('*'); return parseInt(w) > parseInt(h) * 1.5; }) || sizes[0],
    '9:16': sizes.find(s => { const [w, h] = s.split('*'); return parseInt(h) > parseInt(w) * 1.5; }) || sizes[0],
  };
  return ratioToSize[ratio] || config.defaultSize;
}

function resolveQuality(resolution: string): 'low' | 'medium' | 'high' {
  switch (resolution) {
    case '2k': case '4k': return 'high';
    default: return 'low';
  }
}

async function getApiKey(provider: string): Promise<{ key: string; baseUrl: string | null } | null> {
  let apiKey = await queryOne("SELECT id, provider, name, \"apiKey\", \"baseUrl\", \"isActive\", \"createdAt\", \"updatedAt\" FROM api_keys WHERE provider = $1 AND \"isActive\" = true", [provider]);
  if (apiKey?.apiKey) return { key: decodeApiKey(apiKey.apiKey), baseUrl: apiKey.baseUrl || null };
  const aliases = PROVIDER_ALIASES[provider] || [];
  for (const alias of aliases) {
    apiKey = await queryOne("SELECT id, provider, name, \"apiKey\", \"baseUrl\", \"isActive\", \"createdAt\", \"updatedAt\" FROM api_keys WHERE provider = $1 AND \"isActive\" = true", [alias]);
    if (apiKey?.apiKey) return { key: decodeApiKey(apiKey.apiKey), baseUrl: apiKey.baseUrl || null };
  }
  return null;
}


// 将用户选择的比例(1:1/3:4等)映射为text2image端点支持的像素尺寸
// wanx-v1 text2image支持: 1024*1024, 720*1280, 1280*720, 768*1152, 1152*768
function mapMultimodalToText2ImgSize(ratio: string): string {
  const sizeMap: Record<string, string> = {
    '1:1': '1024*1024',
    '3:4': '768*1152',
    '4:3': '1152*768',
    '16:9': '1280*720',
    '9:16': '720*1280',
  };
  return sizeMap[ratio] || '1024*1024';
}

// ============ 万相2.7/2.6 Multimodal Generation 图生图 ============
// 使用 multimodal-generation 端点，content数组同时传text和image
async function generateWanMultimodal(
  apiKey: string, model: string, prompt: string,
  size: string, n: number, referenceImage: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  // 构建content数组 - 图生图时包含参考图，文生图时只传文字
  const content: Array<Record<string, string>> = [
    { text: prompt },
  ];
  // 只在有参考图时才添加image字段，空字符串会导致API报"url error"
  if (referenceImage) {
    content.push({ image: referenceImage });
  }

  const requestBody = {
    model,
    input: {
      messages: [{
        role: 'user',
        content,
      }],
    },
    parameters: {
      size: resolveDashScopeSizeToLabel(size),
      n: Math.min(n, 4),
    },
  };

  logger.info(`[ImageGen] Wan Multimodal: model=${model}, size=${size}, n=${n}, hasRefImage=${!!referenceImage}`);

  const submitResponse = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, Record<string, string>>)?.message || `HTTP ${submitResponse.status}`;
    throw new Error(`万相Multimodal API 提交失败: ${errorMsg}`);
  }

  const submitData = await submitResponse.json();
  const taskId = submitData?.output?.task_id;
  if (!taskId) throw new Error('万相Multimodal API 未返回任务 ID');

  logger.info(`[ImageGen] Wan Multimodal task submitted: ${taskId}`);

  // 轮询等待结果
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pollResponse = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!pollResponse.ok) continue;
    const pollData = await pollResponse.json();
    const status = pollData?.output?.task_status;

    if (status === 'SUCCEEDED') {
      // 万相2.7返回格式：output.choices[0].message.content[0].image
      const choices = pollData?.output?.choices || [];
      const images: Array<{ id: string; url: string; revised_prompt: string }> = [];
      for (const choice of choices) {
        const contents = choice?.message?.content || [];
        for (const c of contents) {
          if (c.type === 'image' && c.image) {
            images.push({
              id: `${Date.now()}-${images.length}`,
              url: c.image,
              revised_prompt: prompt,
            });
          }
        }
      }
      // 兼容老格式 output.results
      if (images.length === 0) {
        const results = pollData?.output?.results || [];
        for (const item of results) {
          images.push({
            id: `${Date.now()}-${images.length}`,
            url: item.url || '',
            revised_prompt: item.actual_prompt || prompt,
          });
        }
      }
      if (images.length === 0) throw new Error('万相返回成功但无图片数据');
      return { images };
    }

    if (status === 'FAILED') {
      const msg = pollData?.output?.message || pollData?.message || '图片生成失败';
      throw new Error(`万相图片生成失败: ${msg}`);
    }
  }

  throw new Error('万相图片生成超时，请稍后重试');
}

// 将像素尺寸转换为万相2.7的size标签（1K/2K/4K）
function resolveDashScopeSizeToLabel(pixelSize: string): string {
  if (pixelSize.includes('2048') || pixelSize.includes('2560') || pixelSize.includes('1440*1440')) return '2K';
  return '1K';
}

// OpenAI-compatible image generation
async function generateOpenAICompatible(
  baseUrl: string, apiKey: string, model: string, prompt: string,
  size: string, n: number, quality: string, outputFormat: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  const requestBody: Record<string, unknown> = { model, prompt, n, size, output_format: outputFormat };
  if (model === 'gpt-image-2') requestBody.quality = quality;

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, unknown>)?.error
      ? ((errorData as Record<string, Record<string, string>>).error.message || 'Unknown error')
      : `HTTP ${response.status}`;
    throw new Error(`${model} API 错误: ${errorMsg}`);
  }

  const data = await response.json();
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';
  const images = (data.data || []).map((item: Record<string, string>, index: number) => ({
    id: `${Date.now()}-${index}`,
    url: item.b64_json ? `data:${mimeType};base64,${item.b64_json}` : item.url || '',
    revised_prompt: item.revised_prompt || prompt,
  }));
  return { images };
}

// Agnes AI 图生图（image参数必须放在extra_body中，不能放顶层）
async function generateAgnesImg2Img(
  baseUrl: string, apiKey: string, model: string, prompt: string,
  size: string, outputFormat: string, referenceImage: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    size,
  };

  // 图生图: image参数必须放在extra_body中
  const extraBody: Record<string, unknown> = {
    response_format: 'url',
  };

  if (referenceImage) {
    // 参考图：支持base64 data URI和URL格式
    if (referenceImage.startsWith('data:')) {
      extraBody.image = [referenceImage];
    } else {
      extraBody.image = [referenceImage];
    }
  }

  requestBody.extra_body = extraBody;

  const response = await fetch(baseUrl + '/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, unknown>)?.error
      ? ((errorData as Record<string, Record<string, string>>).error.message || 'Unknown error')
      : 'HTTP ' + response.status;
    throw new Error('Agnes图生图错误: ' + errorMsg);
  }

  const data = await response.json();
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';
  const images = (data.data || []).map((item: Record<string, string>, index: number) => ({
    id: 'agnes-img2img-' + Date.now() + '-' + index,
    url: item.b64_json ? 'data:' + mimeType + ';base64,' + item.b64_json : item.url || '',
    revised_prompt: item.revised_prompt || prompt,
  }));
  return { images };
}

// DashScope async image generation (qwen/通义千问 text2image)
async function generateDashScopeAsync(
  apiKey: string, dashScopeModel: string, prompt: string,
  size: string, n: number, referenceImage?: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  const input: Record<string, unknown> = { prompt };
  // text2image端点的参考图字段是 ref_img（不是 image），且只接受 URL 不接受 base64
  // 如果参考图是 base64 data URI，text2image 端点无法处理，应该走 multimodal 端点
  if (referenceImage && referenceImage.startsWith('http')) {
    input.ref_img = referenceImage;
    // ref_strength: 参考图相似度 0.0-1.0，默认0.5
    // ref_mode: repaint=基于参考图内容生成, refonly=基于参考图风格生成
  }

  const submitResponse = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: dashScopeModel,
        input,
        parameters: { size, n },
      }),
    }
  );

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, Record<string, string>>)?.message || `HTTP ${submitResponse.status}`;
    throw new Error(`百炼 API 提交失败: ${errorMsg}`);
  }

  const submitData = await submitResponse.json();
  const taskId = submitData?.output?.task_id;
  if (!taskId) throw new Error('百炼 API 未返回任务 ID');

  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pollResponse = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!pollResponse.ok) continue;
    const pollData = await pollResponse.json();
    const status = pollData?.output?.task_status;

    if (status === 'SUCCEEDED') {
      const results = pollData?.output?.results || [];
      const images = results.map((item: Record<string, string>, index: number) => ({
        id: `${Date.now()}-${index}`,
        url: item.url || '',
        revised_prompt: item.actual_prompt || prompt,
      }));
      return { images };
    }

    if (status === 'FAILED') {
      const msg = pollData?.output?.message || '图片生成失败';
      throw new Error(`百炼图片生成失败: ${msg}`);
    }
  }

  throw new Error('百炼图片生成超时，请稍后重试');
}

// Handle image edit via gpt-image-2
async function handleOpenAIEdit(
  apiKey: string, prompt: string, base64Image: string,
  size: string, outputFormat: string, editBaseUrl: string = 'https://api.openai.com/v1'
): Promise<Response> {
  const extractBase64 = (dataUrl: string): string => {
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : dataUrl;
  };
  const imageBase64 = extractBase64(base64Image);
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const formData = new FormData();
  formData.append('model', 'gpt-image-2');
  formData.append('prompt', prompt);
  formData.append('size', size);
  formData.append('output_format', outputFormat);
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
  formData.append('image', imageBlob, 'input.png');

  const response = await fetch(editBaseUrl + '/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, unknown>)?.error
      ? ((errorData as Record<string, Record<string, string>>).error.message || 'Unknown error')
      : `HTTP ${response.status}`;
    return new Response(JSON.stringify({ error: `OpenAI API 错误: ${errorMsg}` }), {
      status: response.status, headers: { 'Content-Type': 'application/json' },
    });
  }
  const data = await response.json();
  const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';
  const images = (data.data || []).map((item: Record<string, string>, index: number) => ({
    id: `${Date.now()}-edit-${index}`,
    url: item.b64_json ? `data:${mimeType};base64,${item.b64_json}` : item.url || '',
    revised_prompt: item.revised_prompt || prompt,
  }));
  return new Response(JSON.stringify({ success: true, images, model: 'gpt-image-2', size }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, model = 'qwen-image-2.0', size = '1:1', resolution = '1k',
      quality: explicitQuality, n = 1, output_format = 'png', referenceImage } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: '请输入提示词' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load model configs from DB (with fallback)
    const MODEL_CONFIGS = await loadModelConfigs();
    const modelConfig = MODEL_CONFIGS[model];
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `不支持的模型: ${model}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const keyData = await getApiKey(modelConfig.provider);
    if (!keyData) {
      const providerNames: Record<string, string> = {
        openai: 'OpenAI', qwen: '通义千问', qwenimage: '通义千问', volcengine: '火山引擎', zhipu: '智谱',
      };
      return new Response(
        JSON.stringify({ error: `未配置 ${providerNames[modelConfig.provider] || modelConfig.provider} 的 API Key，请先在后台添加` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const apiKey = keyData.key;

    // ============ 图生图流程 ============
    if (referenceImage) {
      const apiType = modelConfig.apiType || 'text2image';
      logger.info(`[ImageGen] Image-to-Image: model=${model}, apiType=${apiType}, hasRefImage=true`);

      // 万相2.6/2.7: 有参考图走multimodal端点，纯文生图走text2image端点
      if (apiType === 'multimodal') {
        const dashScopeModel = modelConfig.dashScopeModel || model;
        if (referenceImage) {
          // 图生图: 走multimodal端点（size用标签如1K/2K）
          const actualSize = resolveDashScopeSize(model, size, resolution, MODEL_CONFIGS);
          const result = await generateWanMultimodal(
            apiKey, dashScopeModel, prompt, actualSize, n, referenceImage
          );
          return new Response(JSON.stringify({
            success: true, images: result.images, model, size: actualSize,
          }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          // 纯文生图: multimodal端点要求必须有图片输入，走text2image端点
          // text2image端点需要特定像素尺寸，multimodal的尺寸可能不兼容
          logger.info(`[ImageGen] Multimodal model without ref, using text2image endpoint`);
          const text2imgSize = mapMultimodalToText2ImgSize(size);
          const result = await generateDashScopeAsync(
            apiKey, dashScopeModel, prompt, text2imgSize, Math.min(n, modelConfig.maxN)
          );
          return new Response(JSON.stringify({
            success: true, images: result.images, model, size: text2imgSize,
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // OpenAI gpt-image-2 edits 端点
      if (apiType === 'openai-edit' || modelConfig.provider === 'openai') {
        const actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const editBaseUrl = keyData?.baseUrl || 'https://api.openai.com/v1';
        return handleOpenAIEdit(apiKey, prompt, referenceImage, actualSize, output_format, editBaseUrl);
      }

      // Agnes AI 图生图（image参数必须放在extra_body中）
      if (modelConfig.provider === 'agnes') {
        const actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const agnesBaseUrl = keyData?.baseUrl || 'https://apihub.agnes-ai.com/v1';
        const agnesResult = await generateAgnesImg2Img(
          agnesBaseUrl, apiKey, model, prompt, actualSize, output_format, referenceImage
        );
        return new Response(JSON.stringify({
          success: true, images: agnesResult.images, model, size: actualSize,
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // 百炼 text2image 端点（wanx-v1等老模型）
      // 注意：text2image端点的ref_img只接受URL不接受base64
      // 如果参考图是base64，改走multimodal端点（支持base64）
      if (apiType === 'text2image' && modelConfig.provider === 'qwen') {
        if (referenceImage.startsWith('data:')) {
          // base64参考图 → 走multimodal端点
          logger.info(`[ImageGen] text2image model with base64 ref, redirecting to multimodal endpoint`);
          const actualSize = resolveDashScopeSize(model, size, resolution, MODEL_CONFIGS);
          const result = await generateWanMultimodal(
            apiKey, modelConfig.dashScopeModel || model, prompt, actualSize, n, referenceImage
          );
          return new Response(JSON.stringify({
            success: true, images: result.images, model, size: actualSize,
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        // URL参考图 → 走text2image端点的ref_img字段
        const actualSize = resolveDashScopeSize(model, size, resolution, MODEL_CONFIGS);
        const dashScopeModel = modelConfig.dashScopeModel || model;
        const result = await generateDashScopeAsync(
          apiKey, dashScopeModel, prompt, actualSize, Math.min(n, modelConfig.maxN), referenceImage
        );
        return new Response(JSON.stringify({
          success: true, images: result.images, model, size: actualSize,
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // fallback: 尝试multimodal
      const actualSize = resolveDashScopeSize(model, size, resolution, MODEL_CONFIGS);
      const result = await generateWanMultimodal(
        apiKey, modelConfig.dashScopeModel || model, prompt, actualSize, n, referenceImage
      );
      return new Response(JSON.stringify({
        success: true, images: result.images, model, size: actualSize,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ============ 文生图流程 ============
    const imageCount = Math.min(Math.max(1, n), modelConfig.maxN);
    const quality = (explicitQuality as string) || resolveQuality(resolution);

    let result: { images: Array<{ id: string; url: string; revised_prompt: string }> };
    let actualSize: string;

    switch (modelConfig.provider) {
      case 'openai': {
        actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const openaiBaseUrl = keyData?.baseUrl || 'https://api.openai.com/v1';
        result = await generateOpenAICompatible(
          openaiBaseUrl, apiKey, model, prompt,
          actualSize, imageCount, quality, output_format
        );
        break;
      }
      case 'qwen': {
        actualSize = resolveDashScopeSize(model, size, resolution, MODEL_CONFIGS);
        const dashScopeModel = modelConfig.dashScopeModel || model;
        const apiType = modelConfig.apiType || 'text2image';
        
        // 万相2.6/2.7文生图: multimodal端点要求图片输入，纯文本走text2image
        // text2image需要特定像素尺寸
        if (apiType === 'multimodal') {
          const text2imgSize = mapMultimodalToText2ImgSize(size);
          result = await generateDashScopeAsync(
            apiKey, dashScopeModel, prompt, text2imgSize, imageCount
          );
        } else {
          result = await generateDashScopeAsync(
            apiKey, dashScopeModel, prompt, actualSize, imageCount
          );
        }
        break;
      }
      case 'volcengine': {
        actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const volcBaseUrl = keyData?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
        result = await generateOpenAICompatible(
          volcBaseUrl, apiKey, model, prompt,
          actualSize, imageCount, quality, output_format
        );
        break;
      }
      case 'zhipu': {
        actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const zhipuBaseUrl = keyData?.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
        result = await generateOpenAICompatible(
          zhipuBaseUrl, apiKey, model, prompt,
          actualSize, imageCount, quality, output_format
        );
        break;
      }
      case 'agnes': {
        actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const agnesBaseUrl = keyData?.baseUrl || 'https://api.agnes-ai.com/v1';
        result = await generateOpenAICompatible(
          agnesBaseUrl, apiKey, model, prompt,
          actualSize, imageCount, quality, output_format
        );
        break;
      }
      default:
        return new Response(JSON.stringify({ error: '未知的提供商' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({
      success: true, images: result.images, model, size: actualSize, quality
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '服务器内部错误';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET() {
  const MODEL_CONFIGS = await loadModelConfigs();
  const models = Object.entries(MODEL_CONFIGS).map(([id, config]) => ({
    id,
    provider: config.provider,
    sizes: config.sizes,
    defaultSize: config.defaultSize,
    maxN: config.maxN,
    supportsEdit: config.supportsEdit,
  }));
  return new Response(JSON.stringify({ models }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
