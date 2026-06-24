import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { decodeApiKey } from '@/lib/ai-providers';

// Model configurations
interface ModelConfig {
  provider: 'openai' | 'dashscope' | 'volcengine';
  sizes: Record<string, string[]>; // resolution -> available sizes
  defaultSize: string;
  maxN: number;
  supportsEdit: boolean;
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
    provider: 'dashscope',
    sizes: {
      '1k': ['1024*1024', '720*1280', '1280*720'],
    },
    defaultSize: '1024*1024',
    maxN: 4,
    supportsEdit: false,
  },
  'qwen-image-2.0-pro': {
    provider: 'dashscope',
    sizes: {
      '1k': ['1024*1024', '720*1280', '1280*720'],
      '2k': ['2048*2048', '1440*2560', '2560*1440'],
    },
    defaultSize: '1024*1024',
    maxN: 4,
    supportsEdit: false,
  },
  'wan2.6-t2i': {
    provider: 'dashscope',
    sizes: {
      '1k': ['1280*1280', '720*1280', '1280*720'],
      '2k': ['1440*1440', '1024*1440', '1440*1024'],
    },
    defaultSize: '1280*1280',
    maxN: 4,
    supportsEdit: false,
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

// Size mapping for OpenAI-compatible APIs (using 'x' separator)
function resolveOpenAISize(model: string, ratio: string, resolution: string): string {
  const config = MODEL_CONFIGS[model];
  if (!config) return '1024x1024';

  const resKey = resolution === '2k' || resolution === '4k' ? '2k' : '1k';
  const sizes = config.sizes[resKey] || config.sizes['1k'] || ['1024x1024'];

  // Map ratio to size
  const ratioToSize: Record<string, string> = {
    '1:1': sizes.find(s => s.includes('1024') && s.includes('1024')) || sizes[0],
    '3:4': sizes.find(s => {
      const [w, h] = s.split(/[x*]/);
      return parseInt(w) < parseInt(h);
    }) || sizes[0],
    '4:3': sizes.find(s => {
      const [w, h] = s.split(/[x*]/);
      return parseInt(w) > parseInt(h) && parseInt(w) < 1500;
    }) || sizes[0],
    '16:9': sizes.find(s => {
      const [w, h] = s.split(/[x*]/);
      return parseInt(w) > parseInt(h) * 1.5;
    }) || sizes[0],
    '9:16': sizes.find(s => {
      const [w, h] = s.split(/[x*]/);
      return parseInt(h) > parseInt(w) * 1.5;
    }) || sizes[0],
  };

  return ratioToSize[ratio] || config.defaultSize;
}

// Size mapping for DashScope APIs (using '*' separator)
function resolveDashScopeSize(model: string, ratio: string, resolution: string): string {
  const config = MODEL_CONFIGS[model];
  if (!config) return '1024*1024';

  const resKey = resolution === '2k' || resolution === '4k' ? '2k' : '1k';
  const sizes = config.sizes[resKey] || config.sizes['1k'] || ['1024*1024'];

  const ratioToSize: Record<string, string> = {
    '1:1': sizes.find(s => s.includes('1024*1024') || s.includes('1280*1280') || s.includes('1440*1440')) || sizes[0],
    '3:4': sizes.find(s => {
      const [w, h] = s.split('*');
      return parseInt(w) < parseInt(h);
    }) || sizes[0],
    '4:3': sizes.find(s => {
      const [w, h] = s.split('*');
      return parseInt(w) > parseInt(h);
    }) || sizes[0],
    '16:9': sizes.find(s => {
      const [w, h] = s.split('*');
      return parseInt(w) > parseInt(h) * 1.5;
    }) || sizes[0],
    '9:16': sizes.find(s => {
      const [w, h] = s.split('*');
      return parseInt(h) > parseInt(w) * 1.5;
    }) || sizes[0],
  };

  return ratioToSize[ratio] || config.defaultSize;
}

function resolveQuality(resolution: string): 'low' | 'medium' | 'high' {
  switch (resolution) {
    case '2k':
    case '4k':
      return 'high';
    case '1k':
    default:
      return 'low';
  }
}

// Get API key from database
async function getApiKey(provider: string): Promise<string | null> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { provider, isActive: true },
  });
  if (!apiKey?.apiKey) return null;
  return decodeApiKey(apiKey.apiKey);
}

// OpenAI-compatible image generation (works for OpenAI, DashScope compatible mode, Volcengine)
async function generateOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  size: string,
  n: number,
  quality: string,
  outputFormat: string
): Promise<{ images: Array<{ id: string; url: string; revised_prompt: string }> }> {
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n,
    size,
    output_format: outputFormat,
  };

  // Only add quality for OpenAI models
  if (model === 'gpt-image-2') {
    requestBody.quality = quality;
  }

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, unknown>)?.error
      ? ((errorData as Record<string, Record<string, string>>).error.message || 'Unknown error')
      : `HTTP ${response.status}`;
    throw new Error(`${model} API error: ${errorMsg}`);
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

// Handle image edit via gpt-image-2 edits endpoint
async function handleEdit(
  apiKey: string,
  prompt: string,
  base64Image: string,
  size: string,
  outputFormat: string
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
    return new Response(JSON.stringify({ error: `OpenAI API error: ${errorMsg}` }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
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

// POST /api/image-gen - Generate images
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'gpt-image-2',
      size = '1:1',
      resolution = '1k',
      quality: explicitQuality,
      n = 1,
      output_format = 'png',
      referenceImage,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const modelConfig = MODEL_CONFIGS[model];
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `Model ${model} not supported` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get API Key from database
    const apiKey = await getApiKey(modelConfig.provider);
    if (!apiKey) {
      const providerNames: Record<string, string> = {
        openai: 'OpenAI',
        dashscope: '阿里百炼 (DashScope)',
        volcengine: '火山引擎 (VolcEngine)',
      };
      return new Response(
        JSON.stringify({ 
          error: `${providerNames[modelConfig.provider]} API Key not configured. Please add it in the admin panel.` 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const imageCount = Math.min(Math.max(1, n), modelConfig.maxN);
    const quality = (explicitQuality as string) || resolveQuality(resolution);

    // Handle reference image (edit) - only for gpt-image-2
    if (referenceImage) {
      if (!modelConfig.supportsEdit) {
        return new Response(
          JSON.stringify({ error: `Model ${model} does not support image editing` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const actualSize = resolveOpenAISize(model, size, resolution);
      return handleEdit(apiKey, prompt, referenceImage, actualSize, output_format);
    }

    // Generate based on provider
    let result: { images: Array<{ id: string; url: string; revised_prompt: string }> };
    let actualSize: string;

    switch (modelConfig.provider) {
      case 'openai': {
        actualSize = resolveOpenAISize(model, size, resolution);
        result = await generateOpenAICompatible(
          'https://api.openai.com/v1',
          apiKey,
          model,
          prompt,
          actualSize,
          imageCount,
          quality,
          output_format
        );
        break;
      }
      case 'dashscope': {
        actualSize = resolveDashScopeSize(model, size, resolution);
        // DashScope compatible mode uses OpenAI-compatible API format
        result = await generateOpenAICompatible(
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
          apiKey,
          model,
          prompt,
          actualSize,
          imageCount,
          quality,
          output_format
        );
        break;
      }
      case 'volcengine': {
        actualSize = resolveOpenAISize(model, size, resolution);
        // Volcengine uses OpenAI-compatible API format
        result = await generateOpenAICompatible(
          'https://ark.cn-beijing.volces.com/api/v3',
          apiKey,
          model,
          prompt,
          actualSize,
          imageCount,
          quality,
          output_format
        );
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown provider' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      images: result.images, 
      model, 
      size: actualSize, 
      quality 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /api/image-gen/models - Get available models and their configurations
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
