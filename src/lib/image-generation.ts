import { z } from 'zod';
import { tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getApiKeyByProvider, run } from '@/lib/db';
import { randomUUID } from 'crypto';

const IMAGE_MODELS: Record<string, { provider: string; modelId: string; sizes: string[] }> = {
  'dall-e-3': { provider: 'openai', modelId: 'dall-e-3', sizes: ['1024x1024','1792x1024','1024x1792'] },
  'dall-e-2': { provider: 'openai', modelId: 'dall-e-2', sizes: ['256x256','512x512','1024x1024'] },
  'gpt-image-1': { provider: 'openai', modelId: 'gpt-image-1', sizes: ['1024x1024','1536x1024','1024x1536'] },
};

async function ensureImageTable() {
  await run(`CREATE TABLE IF NOT EXISTS generated_images (id TEXT PRIMARY KEY, prompt TEXT NOT NULL, model TEXT NOT NULL, size TEXT, base64_data TEXT, created_at TIMESTAMP DEFAULT NOW())`);
}

export async function getAvailableImageModels(): Promise<string[]> {
  const a: string[] = [];
  for (const [n, c] of Object.entries(IMAGE_MODELS)) {
    const k = await getApiKeyByProvider(c.provider);
    if (k?.api_key_encrypted && k.is_active) a.push(n);
  }
  return a;
}

export async function generateImageWithModel(prompt: string, modelName = 'dall-e-3', size = '1024x1024') {
  const cfg = IMAGE_MODELS[modelName];
  if (!cfg) throw new Error(`不支持的图片模型: ${modelName}`);
  const kd = await getApiKeyByProvider(cfg.provider);
  if (!kd?.api_key_encrypted) throw new Error(`${cfg.provider} API Key 未配置`);
  const key = Buffer.from(kd.api_key_encrypted, 'base64').toString('utf-8');
  const url = kd.base_url || 'https://api.openai.com/v1';

  // Use REST API directly instead of AI SDK image generation
  const response = await fetch(`${url}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: cfg.modelId, prompt, size, response_format: 'b64_json' }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`图片生成失败: ${response.status} ${err.slice(0, 200)}`);
  }
  const data = await response.json() as any;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('未返回图片数据');

  const id = randomUUID();
  await ensureImageTable();
  await run('INSERT INTO generated_images (id,prompt,model,size,base64_data,created_at) VALUES ($1,$2,$3,$4,$5,NOW())', [id, prompt, modelName, size, b64]);
  return { base64: b64, model: modelName, size };
}

export const imageTools = {
  generate_image: tool({
    description: '根据文字描述生成图片（需要 OpenAI API Key）',
    inputSchema: z.object({
      prompt: z.string().describe('图片描述，详细包含风格、色调、构图'),
      model: z.string().optional().describe('模型：dall-e-3/dall-e-2/gpt-image-1'),
      size: z.string().optional().describe('尺寸：1024x1024/1792x1024/1024x1792'),
    }),
    execute: async ({ prompt, model, size }) => {
      try {
        const r = await generateImageWithModel(prompt, model || 'dall-e-3', size || '1024x1024');
        return `✅ 图片已生成（${r.model}, ${r.size}）`;
      } catch (e: any) { return `❌ 图片生成失败: ${e.message}`; }
    },
  }),
};
