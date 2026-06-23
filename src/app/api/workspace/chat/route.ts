import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { prisma } from '@/lib/db';
import { getModelByProvider } from '@/lib/ai-providers';
import { getModelById } from '@/lib/models';

// 工作区系统提示词
const WORKSPACE_SYSTEM_PROMPT = `你是一个专业的 AI 编程助手，运行在 AI 编程工作区中。

你的职责：
1. 帮助用户编写、修改、调试代码
2. 解释代码逻辑和最佳实践
3. 提供代码重构建议
4. 帮助解决编程问题

工作区功能：
- 左侧是文件树，显示项目文件结构
- 中间是代码编辑器，可以编辑代码
- 右侧是 AI 对话区（你在这里）
- 底部是终端面板

当用户要求创建或修改文件时，请使用以下格式：
\`\`\`file:path/to/file.ext
// 文件内容
\`\`\`

当用户要求执行命令时，请使用以下格式：
\`\`\`command
命令内容
\`\`\`

请始终保持专业、友好，并提供高质量的代码和建议。`;

// POST /api/workspace/chat - 工作区 AI 对话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, modelId, projectId, files } = body;

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

    // 构建系统提示词，包含当前文件上下文
    let systemPrompt = WORKSPACE_SYSTEM_PROMPT;
    if (files && Object.keys(files).length > 0) {
      systemPrompt += '\n\n当前项目文件：\n';
      for (const [path, content] of Object.entries(files)) {
        systemPrompt += `\n--- ${path} ---\n${content}\n`;
      }
    }

    // 构建消息列表
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages,
    ];

    // 保存用户消息
    if (projectId) {
      await prisma.workspaceMessage.create({
        data: {
          role: 'user',
          content: messages[messages.length - 1].content || '',
          conversationId: projectId,
          modelId: modelId,
        },
      });
    }

    // 流式响应
    const result = streamText({
      model,
      messages: chatMessages,
      maxOutputTokens: 8192,
      temperature: 0.7,
    });

    // 保存 AI 响应
    let fullResponse = '';
    const responseStream = new ReadableStream({
      async start(controller) {
        const reader = result.textStream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += value;
          controller.enqueue(new TextEncoder().encode(value));
        }
        controller.close();

        // 保存完整的 AI 响应
        if (projectId) {
          await prisma.workspaceMessage.create({
            data: {
              role: 'assistant',
              content: fullResponse,
              conversationId: projectId,
              modelId: modelId,
            },
          });
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Workspace chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
