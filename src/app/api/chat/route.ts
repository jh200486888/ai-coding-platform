import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { prisma } from '@/lib/db';
import { getModelByProvider } from '@/lib/ai-providers';
import { getModelById } from '@/lib/models';

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
    const model = getModelByProvider(modelConfig.provider, modelConfig.id, apiKey.apiKey);
    if (!model) {
      return new Response(
        JSON.stringify({ error: `Failed to create model for provider ${modelConfig.provider}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 保存用户消息
    const userMessage = await prisma.chatMessage.create({
      data: {
        role: 'user',
        content: messages[messages.length - 1].content || '',
        modelId: modelId,
      },
    });

    // 调用 AI 模型
    const result = streamText({
      model,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
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
