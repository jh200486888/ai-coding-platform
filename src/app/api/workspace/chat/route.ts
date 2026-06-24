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
  let apiKey = await prisma.apiKey.findFirst({
    where: { provider, isActive: true },
  });
  if (apiKey) return apiKey;

  const aliases = PROVIDER_ALIASES[provider] || [];
  for (const alias of aliases) {
    apiKey = await prisma.apiKey.findFirst({
      where: { provider: alias, isActive: true },
    });
    if (apiKey) return apiKey;
  }

  return null;
}

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
      return new Response(JSON.stringify({ error: '请输入消息' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!modelId) {
      return new Response(JSON.stringify({ error: '请先选择模型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取模型配置
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
      return new Response(JSON.stringify({ error: `未找到模型: ${modelId}` }), {
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

    // 获取 AI 模型实例
    let model;
    try {
      model = getModelByProvider(modelConfig.provider, modelConfig.id, decodeApiKey(apiKey.apiKey));
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

    // 构建系统提示词，包含当前文件上下文
    let systemPrompt = WORKSPACE_SYSTEM_PROMPT;
    if (files && Object.keys(files).length > 0) {
      systemPrompt += '\n\n当前项目文件：\n';
      for (const [path, content] of Object.entries(files)) {
        systemPrompt += `\n--- ${path} ---\n${content}\n`;
      }
    }

    // Build messages with attachment support
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

    // 构建消息列表
    const chatMessages: ModelMessage[] = [
      { role: 'system' as const, content: systemPrompt },
      ...aiMessages,
    ];

    // 流式响应
    let result;
    try {
      result = streamText({
        model,
        messages: chatMessages,
        maxOutputTokens: 8192,
        temperature: 0.7,
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

    // 保存用户消息（异步，不阻塞响应）
    const lastMessage = messages[messages.length - 1];
    if (projectId) {
      prisma.workspaceMessage.create({
        data: {
          role: 'user',
          content: lastMessage?.content || '',
          conversationId: projectId,
          modelId: modelId,
        },
      }).catch(() => {});
    }

    // 保存 AI 响应
    let fullResponse = '';
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
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
        } catch (error) {
          console.error('[Workspace Chat] Stream error:', error);
          const errMsg = error instanceof Error ? error.message : String(error);
          let userMsg = 'AI 响应中断';
          if (errMsg.includes('429') || errMsg.includes('余额不足') || errMsg.includes('rate limit')) {
            userMsg = 'API 调用额度不足或被限流，请检查账户余额';
          } else if (errMsg.includes('401') || errMsg.includes('authentication') || errMsg.includes('认证')) {
            userMsg = 'API Key 认证失败，请检查 Key 是否正确';
          } else if (errMsg.includes('404') || errMsg.includes('not found')) {
            userMsg = '模型不存在，请检查模型名称是否正确';
          }
          controller.enqueue(new TextEncoder().encode(`\n\n❌ ${userMsg}`));
          controller.close();
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
    console.error('[Workspace Chat] API error:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误，请稍后重试' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
