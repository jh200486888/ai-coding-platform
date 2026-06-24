import { NextRequest } from 'next/server';
import { streamText, type ModelMessage } from 'ai';
import { prisma } from '@/lib/db';
import { getModelByProvider, decodeApiKey } from '@/lib/ai-providers';
import { getModelById } from '@/lib/models';

interface AttachmentPayload {
  id: string;
  name: string;
  type: 'image' | 'document' | 'code';
  mimeType: string;
  size: number;
  /** base64 data URL */
  url: string;
  content?: string;
}

/**
 * Build the content array for a user message, including attachments.
 * Images are sent as `image` parts; text/code files are decoded and appended as text context.
 */
function buildMessageContent(
  text: string,
  attachments?: AttachmentPayload[]
): string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> {
  if (!attachments || attachments.length === 0) {
    return text;
  }

  const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];

  // Add text content
  if (text) {
    parts.push({ type: 'text', text });
  }

  // Process each attachment
  for (const att of attachments) {
    if (att.type === 'image' && att.mimeType.startsWith('image/')) {
      // Send image as base64 data URL (Vercel AI SDK supports this)
      parts.push({ type: 'image', image: att.url });
    } else {
      // For text/code files, decode base64 and add as text context
      let fileContent = att.content || '';
      if (!fileContent && att.url) {
        try {
          // Extract base64 data from data URL
          const match = att.url.match(/^data:[^;]+;base64,(.+)$/);
          if (match) {
            fileContent = Buffer.from(match[1], 'base64').toString('utf-8');
          }
        } catch {
          fileContent = '(无法解码文件内容)';
        }
      }
      if (fileContent) {
        parts.push({
          type: 'text',
          text: `\n--- 附件: ${att.name} ---\n${fileContent}\n--- 附件结束 ---\n`,
        });
      }
    }
  }

  return parts.length > 0 ? parts : text;
}

// POST /api/chat - 流式对话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, modelId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!modelId) {
      return new Response(JSON.stringify({ error: 'Model ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取模型配置
    const modelConfig = getModelById(modelId);
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: 'Model not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取 API Key
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        provider: modelConfig.provider,
        isActive: true,
      },
    });

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `No API key found for provider ${modelConfig.provider}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 获取 AI 模型实例
    const model = getModelByProvider(modelConfig.provider, modelConfig.id, decodeApiKey(apiKey.apiKey));
    if (!model) {
      return new Response(
        JSON.stringify({ error: `Failed to create model for provider ${modelConfig.provider}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract attachments from the last user message
    const lastMessage = messages[messages.length - 1];
    const lastAttachments: AttachmentPayload[] = lastMessage.attachments || [];

    // Build AI messages with attachment support
    const aiMessages: ModelMessage[] = messages.map((m: { role: string; content: string; attachments?: AttachmentPayload[] }, index: number) => {
      // Only process attachments on the last user message
      if (index === messages.length - 1 && m.attachments && m.attachments.length > 0) {
        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content: buildMessageContent(m.content, m.attachments),
        } as ModelMessage;
      }
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      } as ModelMessage;
    });

    // 保存用户消息（只保存文本内容和附件元数据）
    await prisma.chatMessage.create({
      data: {
        role: 'user',
        content: lastMessage.content || '',
        modelId: modelId,
      },
    });

    // 调用 AI 模型
    const result = streamText({
      model,
      messages: aiMessages,
      maxOutputTokens: modelConfig.maxTokens || 8192,
      temperature: modelConfig.temperature || 0.7,
    });

    // 收集完整响应
    let fullResponse = '';
    const stream = result.textStream;

    // 创建可读流来收集响应
    const reader = stream.getReader();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += value;
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: value })}\n\n`));
          }
          
          // 保存 AI 响应
          await prisma.chatMessage.create({
            data: {
              role: 'assistant',
              content: fullResponse,
              modelId: modelId,
            },
          });

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
