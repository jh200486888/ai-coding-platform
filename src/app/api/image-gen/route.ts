import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// gpt-image-2 size map: ratio -> { 1k, 2k }
const SIZE_MAP: Record<string, Record<string, string>> = {
  '1:1':  { '1k': '1024x1024', '2k': '2048x2048' },
  '3:4':  { '1k': '1024x1536', '2k': '1536x2048' },
  '4:3':  { '1k': '1536x1024', '2k': '2048x1536' },
  '16:9': { '1k': '1024x576',  '2k': '2048x1152' },
  '9:16': { '1k': '576x1024',  '2k': '1152x2048' },
  '3:1':  { '1k': '3072x1024', '2k': '3072x1024' }, // panoramic, same at both resolutions
};

function resolveSize(ratio: string, resolution: string): string {
  const entry = SIZE_MAP[ratio];
  if (!entry) return '1024x1024';
  // 4k uses 2k size (beta upscale hint)
  const key = resolution === '2k' || resolution === '4k' ? '2k' : '1k';
  return entry[key] || '1024x1024';
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

// POST /api/image-gen - Generate images with gpt-image-2
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

    // Get OpenAI API Key from database
    const apiKey = await prisma.apiKey.findFirst({
      where: { provider: 'openai', isActive: true },
    });

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API Key not configured. Please add it in the admin panel.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const imageCount = Math.min(Math.max(1, n), 10);
    const actualSize = resolveSize(size, resolution);
    const quality = (explicitQuality as string) || resolveQuality(resolution);

    // If referenceImage provided, use the edits endpoint
    if (referenceImage) {
      return handleEdit(apiKey.apiKey, prompt, referenceImage, actualSize, output_format);
    }

    // Standard generation
    const requestBody: Record<string, unknown> = {
      model: 'gpt-image-2',
      prompt,
      n: imageCount,
      size: actualSize,
      quality,
      output_format,
    };

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
    const mimeType = output_format === 'jpeg' ? 'image/jpeg' : output_format === 'webp' ? 'image/webp' : 'image/png';

    const images = (data.data || []).map((item: Record<string, string>, index: number) => ({
      id: `${Date.now()}-${index}`,
      url: item.b64_json ? `data:${mimeType};base64,${item.b64_json}` : item.url || '',
      revised_prompt: item.revised_prompt || prompt,
    }));

    return new Response(JSON.stringify({ success: true, images, model: 'gpt-image-2', size: actualSize, quality }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
