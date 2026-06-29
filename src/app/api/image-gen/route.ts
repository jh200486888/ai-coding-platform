import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { decodeApiKey, PROVIDER_ALIASES } from '@/lib/ai-providers';

// Model configurations - interface
interface ModelConfig {
  provider: 'openai' | 'qwen' | 'volcengine' | 'zhipu';
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
    sizes: { '1k': ['1280*1280', '720*1280', '1280*720'], '2k': ['1440*1440', '1024*1440', '1440*1024'] },
    defaultSize: '1280*1280', maxN: 4, supportsEdit: true, apiType: 'multimodal',
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

// ============ 万相2.7/2.6 Multimodal Generation 图生图 ============
// 使用 multimodal-generation 端点，content数组同时传text和image
async function generateWanMultimodal(
  apiKey: string, model: string, prompt: string,
  size: string, n: number, referenceImage: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  // 构建content数组 - 这是图生图的核心
  const content: Array<Record<string, string>> = [
    { text: prompt },
    { image: referenceImage },
  ];

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

  console.log(`[ImageGen] Wan Multimodal: model=${model}, size=${size}, n=${n}, hasRefImage=true`);

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

  console.log(`[ImageGen] Wan Multimodal task submitted: ${taskId}`);

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

// DashScope async image generation (qwen/通义千问 text2image)
async function generateDashScopeAsync(
  apiKey: string, dashScopeModel: string, prompt: string,
  size: string, n: number, referenceImage?: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  const input: Record<string, unknown> = { prompt };
  if (referenceImage) {
    input.image = referenceImage;
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
      console.log(`[ImageGen] Image-to-Image: model=${model}, apiType=${apiType}, hasRefImage=true`);

      // 万相2.6/2.7 multimodal-generation 端点
      if (apiType === 'multimodal') {
        const actualSize = resolveDashScopeSize(model, size, resolution, MODEL_CONFIGS);
        const result = await generateWanMultimodal(
          apiKey, modelConfig.dashScopeModel || model, prompt, actualSize, n, referenceImage
        );
        return new Response(JSON.stringify({
          success: true, images: result.images, model, size: actualSize,
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // OpenAI gpt-image-2 edits 端点
      if (apiType === 'openai-edit' || modelConfig.provider === 'openai') {
        const actualSize = resolveOpenAISize(model, size, resolution, MODEL_CONFIGS);
        const editBaseUrl = keyData?.baseUrl || 'https://api.openai.com/v1';
        return handleOpenAIEdit(apiKey, prompt, referenceImage, actualSize, output_format, editBaseUrl);
      }

      // 百炼 text2image 端点（wanx-v1等老模型）
      if (apiType === 'text2image' && modelConfig.provider === 'qwen') {
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
        
        // 万相2.6/2.7文生图也走multimodal端点
        if (apiType === 'multimodal') {
          result = await generateWanMultimodal(
            apiKey, dashScopeModel, prompt, actualSize, imageCount, ''
          );
          // 如果没传参考图但用multimodal，降级到text2image
          // generateWanMultimodal传空参考图时只发text
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
