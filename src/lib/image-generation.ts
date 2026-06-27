
import { z } from 'zod';
import { tool } from 'ai';

export const imageTools = {
  generate_image: tool({
    description: '根据文字描述生成图片。支持多种模型：通义万相/即梦/OpenAI等。',
    inputSchema: z.object({
      prompt: z.string().describe('图片描述，详细包含风格、色调、构图'),
      model: z.string().optional().describe('模型：wan2.6-t2i(推荐)/qwen-image-2.0/SeedDream-3.0/gpt-image-2'),
    }),
    execute: async ({ prompt, model }) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
        const response = await fetch(`${baseUrl}/api/image-gen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: model || 'wan2.6-t2i',
            size: '1:1',
            resolution: '1k',
            n: 1,
            output_format: 'png',
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Unknown error' }));
          return `❌ 图片生成失败: ${err.error || response.status}`;
        }
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          return `✅ 图片已生成（模型：${data.model}，尺寸：${data.size}）\\n图片链接：${data.images[0].url.slice(0, 100)}...`;
        }
        return '✅ 图片已生成，但未返回图片数据';
      } catch (e: any) {
        return `❌ 图片生成失败: ${e.message}`;
      }
    },
  }),
};

