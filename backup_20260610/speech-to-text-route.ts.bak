import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyByProvider } from '@/lib/db';
import { decodeApiKey } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Try OpenAI Whisper first
    const keyRow = await getApiKeyByProvider('openai');
    if (keyRow?.api_key_encrypted) {
      const apiKey = decodeApiKey(keyRow.api_key_encrypted);
      const baseUrl = keyRow.base_url || 'https://api.openai.com/v1';

      const whisperForm = new FormData();
      whisperForm.append('file', audioFile, 'audio.webm');
      whisperForm.append('model', 'whisper-1');
      whisperForm.append('language', 'zh');

      const res = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperForm,
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ text: data.text || '' });
      }

      logger.warn('Whisper API failed, falling back', res.status);
    }

    return NextResponse.json({
      text: '',
      note: 'Whisper API 未配置或不可用。Chrome/Edge 可直接使用浏览器语音识别。',
    });
  } catch (error) {
    logger.error('Speech-to-text failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '语音识别失败' },
      { status: 500 }
    );
  }
}
