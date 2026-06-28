// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { routeModel } from '@/lib/model-router';
import { z } from 'zod';

const DESIGN_SYSTEM_PROMPT = `你是一个专业的设计助手，擅长根据用户描述生成精美的HTML/CSS设计稿。

【核心能力】
- 生成完整的HTML页面设计（包含内联CSS和JS）
- 支持海报、社媒封面、PPT、Logo、产品页等多种设计类型
- 输出的HTML会在iframe中实时预览

【设计规范】
- 设计要现代、专业、有视觉冲击力
- 优先使用渐变、毛玻璃、阴影等现代CSS效果
- 字体使用系统字体栈，不需要外部引入
- 所有样式必须内联在<style>标签中
- 响应式设计，适配不同屏幕

【输出格式】
1. 先用1-2句话描述你将要生成的设计
2. 然后直接调用 preview_html 工具展示设计结果
3. 如果用户要求修改，基于上一次设计调整后重新调用 preview_html

【禁止】
- 不要只输出代码文本，必须调用 preview_html 工具
- 不要使用外部图片URL（除非用户提供）
- 不要输出markdown代码块包裹的HTML`;

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const routeResult = await routeModel(message, 'design');
    if (!routeResult) {
      return NextResponse.json({ error: 'No API key configured. Please add an API key in settings.' }, { status: 500 });
    }

    const { provider, model: modelId, apiKey, baseUrl } = routeResult;

    const PROVIDER_URLS = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      deepseek: 'https://api.deepseek.com',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      moonshot: 'https://api.moonshot.cn/v1',
      baidu: 'https://qianfan.baidubce.com/v2',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3',
      groq: 'https://api.groq.com/openai/v1',
      'openai-image': 'https://api.openai.com/v1',
    };

    const apiUrl = baseUrl || PROVIDER_URLS[provider] || 'https://api.deepseek.com';

    const model = createOpenAICompatible({
      name: provider,
      baseURL: apiUrl,
      apiKey: apiKey,
    }).languageModel(modelId);

    const previewHtmlTool = tool({
      description: 'Preview HTML design in a sandboxed iframe. Use this to show your design to the user. Always call this after generating HTML code.',
      inputSchema: z.object({
        html: z.string().describe('Complete HTML content to preview'),
        title: z.string().optional().describe('Title for the design'),
        viewport: z.enum(['desktop', 'tablet', 'mobile']).default('desktop').describe('Viewport size'),
      }),
      execute: async ({ html, title, viewport = 'desktop' }) => {
        try {
          const encodedHtml = Buffer.from(html).toString('base64');
          return `<!--HTML_PREVIEW\ntitle:${title || 'Design Preview'}\nviewport:${viewport}\nhtml:${encodedHtml}\n-->`;
        } catch (e) {
          return 'HTML预览生成失败';
        }
      },
    });

    const result = streamText({
      model,
      system: DESIGN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
      tools: { preview_html: previewHtmlTool },
      maxSteps: 3,
    });

    const stream = result.toUIMessageStream();
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Conversation-Id': conversationId || '',
        'X-Model-Route': routeResult.routingReason,
      },
    });
  } catch (e) {
    console.error('[Design Chat] Error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
