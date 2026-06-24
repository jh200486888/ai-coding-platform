import { NextRequest } from 'next/server';
import { streamText, type ModelMessage } from 'ai';
import { prisma } from '@/lib/db';
import { getModelByProvider, decodeApiKey, PROVIDER_ALIASES } from '@/lib/ai-providers';
import { getModelById } from '@/lib/models';

interface AttachmentPayload {
  id: string;
  name: string;
  type: 'image' | 'document' | 'code';
  mimeType: string;
  size: number;
  url: string;
  content?: string;
}

function buildMessageContent(
  text: string,
  attachments?: AttachmentPayload[]
): string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> {
  if (!attachments || attachments.length === 0) {
    return text;
  }

  const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];

  if (text) {
    parts.push({ type: 'text', text });
  }

  for (const att of attachments) {
    if (att.type === 'image' && att.mimeType.startsWith('image/')) {
      parts.push({ type: 'image', image: att.url });
    } else {
      let fileContent = att.content || '';
      if (!fileContent && att.url) {
        try {
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

// 查找 API Key，支持 provider 别名映射
async function findApiKey(provider: string) {
  // 先按原 provider 查找
  let apiKey = await prisma.apiKey.findFirst({
    where: { provider, isActive: true },
  });
  if (apiKey) return apiKey;

  // 按别名查找（如 qwen → dashscope）
  const aliases = PROVIDER_ALIASES[provider] || [];
  for (const alias of aliases) {
    apiKey = await prisma.apiKey.findFirst({
      where: { provider: alias, isActive: true },
    });
    if (apiKey) return apiKey;
  }

  return null;
}

// POST /api/chat - 流式对话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, modelId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '请输入消息' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!modelId) {
      return new Response(JSON.stringify({ error: '请选择模型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取模型配置 - 先查前端列表，再查数据库
    let modelConfig = getModelById(modelId);
    if (!modelConfig) {
      const dbConfig = await prisma.modelConfig.findFirst({
        where: { modelId: modelId, isActive: true },
      });
      if (dbConfig) {
        modelConfig = {
          id: dbConfig.modelId,
          name: dbConfig.name,
          provider: dbConfig.provider,
        };
      }
    }
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `未找到模型: ${modelId}，请在后台配置` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取 API Key（支持别名映射）
    const apiKey = await findApiKey(modelConfig.provider);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `未配置 ${modelConfig.provider} 的 API Key，请先在后台添加` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const decodedKey = decodeApiKey(apiKey.apiKey);

    // 获取 AI 模型实例
    let model;
    try {
      model = getModelByProvider(modelConfig.provider, modelConfig.id, decodedKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: `创建模型失败: ${msg}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Build AI messages
    const aiMessages: ModelMessage[] = messages.map((m: { role: string; content: string; attachments?: AttachmentPayload[] }, index: number) => {
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

    // 调用 AI 模型
    let result;
    try {
      result = streamText({
        model,
        messages: aiMessages,
        maxOutputTokens: modelConfig.maxTokens || 8192,
        temperature: modelConfig.temperature ?? 0.7,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: `AI 调用失败: ${msg}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 流式响应
    let fullResponse = '';
    const stream = result.textStream;
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
          
          // 保存对话
          try {
            await prisma.chatMessage.create({
              data: {
                role: 'user',
                content: messages[messages.length - 1]?.content || '',
                modelId: modelId,
              },
            });
            await prisma.chatMessage.create({
              data: {
                role: 'assistant',
                content: fullResponse,
                modelId: modelId,
              },
            });
          } catch {
            // 保存失败不影响响应
          }

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[Chat] Stream error:', error);
          // 发送错误信息给前端
          const errMsg = error instanceof Error ? error.message : String(error);
          // 检查是否是 API 错误（如余额不足、认证失败等）
          let userMsg = 'AI 响应中断';
          if (errMsg.includes('429') || errMsg.includes('余额不足') || errMsg.includes('rate limit')) {
            userMsg = 'API 调用额度不足或被限流，请检查账户余额';
          } else if (errMsg.includes('401') || errMsg.includes('authentication') || errMsg.includes('认证')) {
            userMsg = 'API Key 认证失败，请检查 Key 是否正确';
          } else if (errMsg.includes('404') || errMsg.includes('not found')) {
            userMsg = '模型不存在，请检查模型名称是否正确';
          }
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: userMsg })}\n\n`));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
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
    console.error('[Chat] API error:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误，请稍后重试' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
