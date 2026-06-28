// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { routeModel } from '@/lib/model-router';
import { z } from 'zod';

const DESIGN_SYSTEM_PROMPT = `You are a professional design assistant that creates beautiful HTML/CSS designs based on user descriptions.

[Core Abilities]
- Generate complete HTML page designs (with inline CSS and JS)
- Support posters, social media covers, PPT, Logo, product pages and more
- Output HTML is previewed in a sandboxed iframe

[Design Standards]
- Modern, professional, visually striking designs
- Use gradients, glassmorphism, shadows and other modern CSS effects
- Use system font stacks, no external imports needed
- All styles must be inline in <style> tags
- Responsive design for different screens

[Output Format]
1. Briefly describe the design you will create (1-2 sentences)
2. Call the preview_html tool to show the design
3. If user requests changes, adjust and call preview_html again

[Prohibited]
- Do NOT output code text without calling preview_html tool
- Do NOT use external image URLs (unless provided by user)
- Do NOT wrap HTML in markdown code blocks`;

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const routeResult = await routeModel(message, 'design');
    if (!routeResult) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
    }

    const { provider, model: modelId, apiKey, baseUrl } = routeResult;

    const PROVIDER_URLS = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta/openai',
      deepseek: 'https://api.deepseek.com/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      moonshot: 'https://api.moonshot.cn/v1',
      baidu: 'https://qianfan.baidubce.com/v2',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3',
      groq: 'https://api.groq.com/openai/v1',
      'openai-image': 'https://api.openai.com/v1',
    };

    const apiUrl = baseUrl || PROVIDER_URLS[provider] || 'https://api.deepseek.com/v1';

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
          return '<!--HTML_PREVIEW\ntitle:' + (title || 'Design Preview') + '\nviewport:' + viewport + '\nhtml:' + encodedHtml + '\n-->';
        } catch (e) {
          return 'HTML preview generation failed';
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
