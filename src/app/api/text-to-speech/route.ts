import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyByProvider } from '@/lib/db';
import { decodeApiKey } from '@/lib/ai-providers';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'alloy' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: '缺少文本内容' }, { status: 400 });
    }

    // 截断过长文本（OpenAI TTS 限制 4096 字符）
    const truncatedText = text.length > 4000 ? text.slice(0, 4000) + '...' : text;

    const keyRow = await getApiKeyByProvider('openai');
    if (!keyRow?.api_key_encrypted) {
      return NextResponse.json({ error: 'OpenAI API Key 未配置' }, { status: 500 });
    }

    const apiKey = decodeApiKey(keyRow.api_key_encrypted);
    const baseUrl = keyRow.base_url || 'https://api.openai.com/v1';

    const response = await fetch(baseUrl + '/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: truncatedText,
        voice: voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('TTS API error:', response.status, errText);
      return NextResponse.json({ error: 'TTS API 调用失败' }, { status: 502 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('TTS failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '语音合成失败' },
      { status: 500 }
    );
  }
}
