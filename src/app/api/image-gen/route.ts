import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { decodeApiKey, PROVIDER_ALIASES } from '@/lib/ai-providers';

// Model configurations
interface ModelConfig {
  provider: 'openai' | 'qwen' | 'volcengine';
  sizes: Record<string, string[]>;
  defaultSize: string;
  maxN: number;
  supportsEdit: boolean;
  // For qwen models that use async API
  dashScopeModel?: string;
  // Model used for image-to-image (if different from text-to-image)
  editModel?: string;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-image-2': {
    provider: 'openai',
    sizes: {
      '1k': ['1024x1024', '1536x1024', '1024x1536'],
      '2k': ['2048x2048', '2048x1536', '1536x2048', '2048x1152', '1152x2048'],
    },
    defaultSize: '1024x1024',
    maxN: 10,
    supportsEdit: true,
  },
  'qwen-image-2.0': {
    provider: 'qwen',
    dashScopeModel: 'wanx2.1-t2i-turbo',
    sizes: {
      '1k': ['1024*1024', '720*1280', '1280*720'],
    },
    defaultSize: '1024*1024',
    maxN: 4,
    supportsEdit: false,
  },
  'qwen-image-2.0-pro': {
    provider: 'qwen',
    dashScopeModel: 'wanx2.1-t2i-plus',
    sizes: {
      '1k': ['1024*1024', '720*1280', '1280*720'],
      '2k': ['2048*2048', '1440*2560', '2560*1440'],
    },
    defaultSize: '1024*1024',
    maxN: 4,
    supportsEdit: false,
  },
  'wan2.6-t2i': {
    provider: 'qwen',
    dashScopeModel: 'wanx-v1',
    sizes: {
      '1k': ['1280*1280', '720*1280', '1280*720'],
      '2k': ['1440*1440', '1024*1440', '1440*1024'],
    },
    defaultSize: '1280*1280',
    maxN: 4,
    supportsEdit: false,
  },
  // 新增：万相图生图专用模型
  'wanx-v1-edit': {
    provider: 'qwen',
    dashScopeModel: 'wanx-v1',
    sizes: {
      '1k': ['1024*1024', '720*1280', '1280*720'],
    },
    defaultSize: '1024*1024',
    maxN: 4,
    supportsEdit: true,  // 支持图生图
  },
  'SeedDream-3.0': {
    provider: 'volcengine',
    sizes: {
      '1k': ['1024x1024', '768x1024', '1024x768', '576x1024', '1024x576'],
      '2k': ['2048x2048', '1536x2048', '2048x1536'],
    },
    defaultSize: '1024x1024',
    maxN: 4,
    supportsEdit: false,
  },
};

function resolveOpenAISize(model: string, ratio: string, resolution: string): string {
  const config = MODEL_CONFIGS[model];
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

function resolveDashScopeSize(model: string, ratio: string, resolution: string): string {
  const config = MODEL_CONFIGS[model];
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

async function getApiKey(provider: string): Promise<string | null> {
  let apiKey = await queryOne("SELECT id, provider, name, \"apiKey\", \"baseUrl\", \"isActive\", \"createdAt\", \"updatedAt\" FROM api_keys WHERE provider = $1 AND \"isActive\" = true", [provider]);
  if (apiKey?.apiKey) return decodeApiKey(apiKey.apiKey);
  const aliases = PROVIDER_ALIASES[provider] || [];
  for (const alias of aliases) {
    apiKey = await queryOne("SELECT id, provider, name, \"apiKey\", \"baseUrl\", \"isActive\", \"createdAt\", \"updatedAt\" FROM api_keys WHERE provider = $1 AND \"isActive\" = true", [alias]);
    if (apiKey?.apiKey) return decodeApiKey(apiKey.apiKey);
  }
  return null;
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

// DashScope async image generation (qwen/通义千问 models)
// Supports both text-to-image and image-to-image
async function generateDashScopeAsync(
  apiKey: string, dashScopeModel: string, prompt: string,
  size: string, n: number, referenceImage?: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  // Build input object
  const input: Record<string, unknown> = { prompt };
  
  // If reference image provided, add it for image-to-image
  // wanx-v1 model supports image input for 图生图
  if (referenceImage) {
    input.image = referenceImage;
  }

  // Step 1: Submit task
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

  // Step 2: Poll for result (max 120 seconds)
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3s interval

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
    // PENDING / RUNNING → continue polling
  }

  throw new Error('百炼图片生成超时，请稍后重试');
}

// Handle image edit via gpt-image-2
async function handleOpenAIEdit(
  apiKey: string, prompt: string, base64Image: string,
  size: string, outputFormat: string
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

  const response = await fetch('https://api.openai.com/v1/images/edits', {
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

    const modelConfig = MODEL_CONFIGS[model];
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `不支持的模型: ${model}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // If reference image provided, find a model that supports editing
    let effectiveModel = model;
    let effectiveConfig = modelConfig;
    
    if (referenceImage) {
      // If current model doesn't support edit, auto-switch to wanx-v1-edit (百炼图生图)
      if (!modelConfig.supportsEdit) {
        effectiveModel = 'wanx-v1-edit';
        effectiveConfig = MODEL_CONFIGS['wanx-v1-edit'];
      }
      
      const apiKey = await getApiKey(effectiveConfig.provider);
      if (!apiKey) {
        const providerNames: Record<string, string> = {
          openai: 'OpenAI', qwen: '通义千问', volcengine: '火山引擎',
        };
        return new Response(
          JSON.stringify({ error: `图生图需要 ${providerNames[effectiveConfig.provider] || effectiveConfig.provider} 的 API Key，请先在后台添加` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // OpenAI gpt-image-2 uses /images/edits endpoint
      if (effectiveConfig.provider === 'openai') {
        const actualSize = resolveOpenAISize(effectiveModel, size, resolution);
        return handleOpenAIEdit(apiKey, prompt, referenceImage, actualSize, output_format);
      }

      // DashScope models: use same async API but with image field
      if (effectiveConfig.provider === 'qwen') {
        const actualSize = resolveDashScopeSize(effectiveModel, size, resolution);
        const dashScopeModel = effectiveConfig.dashScopeModel || effectiveModel;
        const result = await generateDashScopeAsync(
          apiKey, dashScopeModel, prompt, actualSize, Math.min(n, effectiveConfig.maxN), referenceImage
        );
        return new Response(JSON.stringify({
          success: true, images: result.images, model: effectiveModel, size: actualSize,
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Text-to-image flow
    const apiKey = await getApiKey(modelConfig.provider);
    if (!apiKey) {
      const providerNames: Record<string, string> = {
        openai: 'OpenAI', qwen: '通义千问', volcengine: '火山引擎',
      };
      return new Response(
        JSON.stringify({ error: `未配置 ${providerNames[modelConfig.provider] || modelConfig.provider} 的 API Key，请先在后台添加` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const imageCount = Math.min(Math.max(1, n), modelConfig.maxN);
    const quality = (explicitQuality as string) || resolveQuality(resolution);

    let result: { images: Array<{ id: string; url: string; revised_prompt: string }> };
    let actualSize: string;

    switch (modelConfig.provider) {
      case 'openai': {
        actualSize = resolveOpenAISize(model, size, resolution);
        result = await generateOpenAICompatible(
          'https://api.openai.com/v1', apiKey, model, prompt,
          actualSize, imageCount, quality, output_format
        );
        break;
      }
      case 'qwen': {
        actualSize = resolveDashScopeSize(model, size, resolution);
        const dashScopeModel = modelConfig.dashScopeModel || model;
        result = await generateDashScopeAsync(
          apiKey, dashScopeModel, prompt, actualSize, imageCount
        );
        break;
      }
      case 'volcengine': {
        actualSize = resolveOpenAISize(model, size, resolution);
        result = await generateOpenAICompatible(
          'https://ark.cn-beijing.volces.com/api/v3', apiKey, model, prompt,
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
