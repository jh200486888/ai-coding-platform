// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { routeModel } from '@/lib/model-router';
import { getApiKeyByProvider } from '@/lib/db';
import { z } from 'zod';

const DESIGN_SYSTEM_PROMPT = `You are a professional design assistant that creates beautiful HTML/CSS designs and generates images based on user descriptions.

[Core Abilities]
- Generate complete HTML page designs (with inline CSS and JS)
- Generate images from text descriptions (posters, logos, illustrations, etc.)
- Support image-to-image: when user provides a reference image, incorporate its style/content into the new design
- Support posters, social media covers, PPT, Logo, product pages and more

[When to Use Each Tool]
- preview_html: When user wants a web design, page layout, or HTML-based design
- generate_image: When user wants a standalone image, illustration, photo, or visual content

[Image Generation]
- If user provides a reference image, describe it in detail and incorporate its style into the prompt
- Always generate detailed, specific prompts for best image quality
- Include style, composition, colors, mood, and key visual elements

[Design Standards]
- Modern, professional, visually striking designs
- Use gradients, glassmorphism, shadows and other modern CSS effects
- Use system font stacks, no external imports needed
- All styles must be inline in <style> tags

[Output Format]
1. Briefly describe what you will create (1-2 sentences)
2. Call the appropriate tool to show the design/image
3. After generate_image returns, you MUST include [IMAGE:result_path] in your response text

[Prohibited]
- Do NOT output code text without calling a tool
- Do NOT use external image URLs (unless provided by user)
- Do NOT wrap HTML in markdown code blocks`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, referenceImage } = body;
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const routeResult = await routeModel(message, 'design');
    if (!routeResult) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
    }

    const { provider, model: modelId, apiKey, baseUrl } = routeResult;

    const PROVIDER_URLS: Record<string, string> = {
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
      description: 'Preview HTML design in a sandboxed iframe. Use this to show your design to the user.',
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

    const generateImageTool = tool({
      description: 'Generate an image from a text description. Use this when user wants to create an image, illustration, photo, poster image, logo image, or any visual content.',
      inputSchema: z.object({
        prompt: z.string().describe('Detailed image generation prompt in English. Describe the visual content, style, composition, colors, and mood.'),
        size: z.enum(['1024x1024', '1024x1792', '1792x1024']).default('1024x1024').describe('Image size'),
      }),
      execute: async ({ prompt, size = '1024x1024' }) => {
        try {
          const apiKeyData = await getApiKeyByProvider('openai');
          if (!apiKeyData || !apiKeyData.is_active) {
            return 'Image generation unavailable: OpenAI API key not configured.';
          }
          const decodedKey = Buffer.from(apiKeyData.api_key_encrypted, 'base64').toString('utf-8');
          const imgBaseUrl = apiKeyData.base_url || 'https://api.openai.com/v1';
          
          const response = await fetch(imgBaseUrl + '/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + decodedKey,
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: prompt,
              n: 1,
              size: size,
              response_format: 'b64_json',
            }),
          });
          
          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            return 'Image generation failed: ' + response.status + ' ' + errText.slice(0, 200);
          }
          
          const data = await response.json();
          const imageData = data.data?.[0];
          if (imageData?.b64_json) {
            const fs = await import('fs/promises');
            const path = await import('path');
            const imgDir = path.join(process.cwd(), 'public', 'generated');
            await fs.mkdir(imgDir, { recursive: true });
            const imgId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            const imgPath = path.join(imgDir, imgId + '.png');
            const imgBuffer = Buffer.from(imageData.b64_json, 'base64');
            await fs.writeFile(imgPath, imgBuffer);
            const imgUrl = '/generated/' + imgId + '.png';
            return 'IMAGE_GENERATED:' + imgUrl;
          }
          if (imageData?.url) {
            return 'IMAGE_GENERATED:' + imageData.url;
          }
          return 'Image generation failed: no image data returned';
        } catch (e: any) {
          return 'Image generation error: ' + (e.message || 'Unknown error');
        }
      },
    });

    // Build user message content - include reference image if provided
    let userContent: string | any[] = message;
    if (referenceImage) {
      userContent = [
        { type: 'text', text: message },
        { type: 'image', image: referenceImage },
      ];
    }

    const result = streamText({
      model,
      system: DESIGN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      tools: { preview_html: previewHtmlTool, generate_image: generateImageTool },
      maxSteps: 5,
    });

    // Use createUIMessageStreamResponse for proper streaming (same as main chat)
    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(result.toUIMessageStream({
          sendReasoning: true,
          messageMetadata: ({ part }: any) => {
            if (part.type === 'start' || part.type === 'finish') {
              return { conversationId } as any;
            }
            return undefined;
          },
        }));

        // Wait for completion and process IMAGE_GENERATED results
        const finalText = await result.text;
        const steps = await result.steps;
        
        // Extract generated images from tool results
        for (const step of steps) {
          for (const tc of step.toolCalls || []) {
            if (tc.toolName === 'generate_image') {
              const tr = step.toolResults?.find((r: any) => r.toolCallId === tc.toolCallId);
              if (tr) {
                const output = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
                const imgMatch = output.match(/IMAGE_GENERATED:(\/generated\/[^\s]+)/);
                if (imgMatch) {
                  // Send a custom data part for image display
                  writer.write({
                    type: 'data',
                    data: [{ type: 'image_generated', url: imgMatch[1] }],
                  });
                }
              }
            }
          }
        }
      },
      onError: (error) => {
        console.error('[Design Chat] Stream error:', error);
        return 'An error occurred during design generation.';
      },
    });

    return createUIMessageStreamResponse({
      stream: uiStream,
      headers: {
        'X-Conversation-Id': conversationId || '',
        'X-Model-Route': routeResult.routingReason,
      },
    });
  } catch (e) {
    console.error('[Design Chat] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
