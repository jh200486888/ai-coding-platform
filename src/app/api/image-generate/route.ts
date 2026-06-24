import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { prompt, modelId, size, n } = await request.json() as {
      prompt: string;
      modelId?: string;
      size?: string;
      n?: number;
    };

    if (!prompt) {
      return NextResponse.json({ error: '请输入图片描述' }, { status: 400 });
    }

    const model = modelId || 'dall-e-3';
    const modelConfig = await getModelConfig(model);

    // Try to get API key for the model's provider, or fall back to openai
    let apiKeyData = modelConfig ? await getApiKeyByProvider(modelConfig.provider) : null;
    if (!apiKeyData) {
      apiKeyData = await getApiKeyByProvider('openai');
    }
    if (!apiKeyData || !apiKeyData.is_active) {
      return NextResponse.json({ error: '请先在后台配置 OpenAI 的 API Key' }, { status: 400 });
    }

    const apiKey = Buffer.from(apiKeyData.api_key_encrypted, 'base64').toString('utf-8');
    const baseUrl = apiKeyData.base_url || 'https://api.openai.com/v1';

    // Call image generation API
    const response = await fetch(baseUrl + '/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        n: n || 1,
        size: size || '1024x1024',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: '图片生成失败: ' + response.status + ' ' + errText.slice(0, 500) }, { status: response.status });
    }

    const data = await response.json();
    const images = (data.data || []).map((item: any) => ({
      url: item.b64_json ? 'data:image/png;base64,' + item.b64_json : item.url,
      revised_prompt: item.revised_prompt || '',
    }));

    return NextResponse.json({ images, model: model });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
