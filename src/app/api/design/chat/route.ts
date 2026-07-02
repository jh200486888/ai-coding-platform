// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { routeModel } from '@/lib/model-router';
import { getSetting } from '@/lib/db';
import { z } from 'zod';

const DESIGN_SYSTEM_PROMPT = `You are a professional e-commerce design assistant specializing in creating commercial visuals based on reference images.

[Core Principle - REFERENCE IMAGE ADHERENCE]
- When user provides a reference image, you MUST carefully analyze and replicate its:
  * Layout and composition structure
  * Color scheme and visual style
  * Typography and text placement
  * Product presentation style
  * Background and decorative elements
- The reference image is your PRIMARY guide. Match its design language closely.
- If user says "按参考图做" or "make it like the reference", replicate the reference style faithfully.

[Design Capabilities]
- E-commerce product images (主图, 详情页, 海报, banner)
- Social media visuals (小红书封面, 朋友圈海报, 公众号头图)
- Marketing materials (促销海报, 节日活动图, 品牌宣传)
- Image generation with specific sizes and ratios

[Tool Usage Rules]
- generate_image: For creating standalone images (posters, product shots, illustrations)
  * ALWAYS include the user's requested size/ratio in the prompt
  * When reference image exists, describe its style in detail in the prompt
  * For e-commerce: include product details, promotional text, price tags in prompt
  * Specify output ratio: "3:4 vertical poster", "1:1 product main image", "16:9 banner"
- preview_html: For HTML/CSS page layouts only (not for image generation)

[Image Generation Prompt Rules]
- Write prompts in English for best quality
- Structure: [STYLE from reference] + [COMPOSITION] + [CONTENT] + [RATIO] + [TEXT if any]
- For posters: "E-commerce poster, [product], [layout style], [colors], [text: promotional copy], [ratio]"
- For product images: "Product photography, [product], [background], [lighting], [angle], [ratio]"
- ALWAYS specify the target ratio in the prompt (e.g., "3:4 vertical", "16:9 wide banner")

[Size/Ratio Instructions]
- 3:4 = Vertical poster, e-commerce main image (portrait)
- 4:3 = Horizontal product shot
- 16:9 = Banner, social media cover
- 9:16 = Story format, vertical banner
- 1:1 = Square product image, social media post
- User's size request MUST be respected - pass it to generate_image tool

[Output Format]
1. Brief description of what you will create (1-2 sentences)
2. Call generate_image with detailed prompt including reference style + requested size
3. After generate_image returns, include [IMAGE:result_path] in response

[Prohibited]
- Do NOT ignore user's size/ratio requirements
- Do NOT generate images without considering the reference image style
- Do NOT output code text without calling a tool
- Do NOT use external image URLs`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, referenceImage } = body;
    // Read design system prompt from DB (fallback to hardcoded)
    let dbDesignPrompt = '';
    try { const p = await getSetting('design_system_prompt'); if (p && p.length > 20) dbDesignPrompt = p; } catch {}
    // Make reference image available to tool execute functions
    const contextReferenceImage = referenceImage;
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
        size: z.enum(['1:1', '3:4', '4:3', '16:9', '9:16']).default('3:4').describe('Image aspect ratio: 1:1 square, 3:4 vertical poster, 4:3 horizontal, 16:9 banner, 9:16 story'),
      }),
      execute: async ({ prompt, size = '1024x1024' }) => {
        try {
          // Use internal image-gen API which supports multiple providers (qwen/openai/volcengine)
          const response = await fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/image-gen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt, model: modelId.includes('image') || modelId.includes('wan') || modelId.includes('wanx') || modelId.includes('dream') || modelId.includes('cogview') || modelId.includes('gpt-image') ? modelId : 'wan2.6-t2i', size: size,
              resolution: '1k', quality: 'low', n: 1, output_format: 'png',
              referenceImage: contextReferenceImage || undefined,
            }),
          });
          const data = await response.json();
          if (!data.success || !data.images?.length) {
            return 'Image generation failed: ' + (data.error || 'Unknown error');
          }
          // Download and save image locally
          const imgUrl = data.images[0].url;
          if (imgUrl.startsWith('data:')) {
            const fs = await import('fs/promises');
            const path = await import('path');
            const imgDir = path.join(process.cwd(), 'public', 'generated');
            await fs.mkdir(imgDir, { recursive: true });
            const imgId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            const imgPath = path.join(imgDir, imgId + '.png');
            const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
            await fs.writeFile(imgPath, Buffer.from(base64Data, 'base64'));
            return 'IMAGE_GENERATED:/generated/' + imgId + '.png';
          }
          // External URL - download and save locally
          const imgResponse = await fetch(imgUrl);
          if (imgResponse.ok) {
            const fs = await import('fs/promises');
            const path = await import('path');
            const imgDir = path.join(process.cwd(), 'public', 'generated');
            await fs.mkdir(imgDir, { recursive: true });
            const imgId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            const imgPath = path.join(imgDir, imgId + '.png');
            const buffer = Buffer.from(await imgResponse.arrayBuffer());
            await fs.writeFile(imgPath, buffer);
            return 'IMAGE_GENERATED:/generated/' + imgId + '.png';
          }
          return 'IMAGE_GENERATED:' + imgUrl;
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
      system: dbDesignPrompt || DESIGN_SYSTEM_PROMPT,
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
