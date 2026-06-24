import { NextRequest } from 'next/server';
import { streamText, stepCountIs } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { tool } from 'ai';
import { query, queryOne, run } from '@/lib/db';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';

const PROJECT_DIR = '/www/wwwroot/agent.piyiguo.com';

// Provider URL mappings
const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  moonshot: 'https://api.moonshot.cn/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  groq: 'https://api.groq.com/openai/v1',
};

const MODEL_IDENTITY: Record<string, string> = {
  deepseek: 'DeepSeek 深度求索',
  zhipu: '智谱AI (GLM)',
  qwen: '通义千问 (Qwen)',
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  moonshot: 'Kimi 月之暗面',
  doubao: '豆包 (Doubao)',
  groq: 'Groq (Llama)',
};

// Tool execution functions (operate on workspace_files DB + server filesystem)
async function execCreateFile(projectId: string, path: string, content: string): Promise<string> {
  const { randomUUID } = await import('crypto');
  const fs = await import('fs/promises');

  // Write to server filesystem
  const filePath = `${PROJECT_DIR}/${path}`;
  await fs.mkdir(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');

  // Save to DB
  const existing = await queryOne('SELECT id FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
  if (existing) {
    await run('UPDATE workspace_files SET content = $1, "updatedAt" = NOW() WHERE id = $2', [content, existing.id]);
  } else {
    const id = randomUUID();
    const name = path.split('/').pop() || path;
    await run(
      'INSERT INTO workspace_files (id, "projectId", name, path, content, type, "updatedAt") VALUES ($1, $2, $3, $4, $5, \'file\', NOW())',
      [id, projectId, name, path, content]
    );
  }
  return `✅ 文件已创建: ${path}`;
}

async function execEditFile(projectId: string, path: string, oldText: string, newText: string): Promise<string> {
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  const content = await fs.readFile(filePath, 'utf-8');
  const newContent = content.replace(oldText, newText);
  if (newContent === content) return '⚠️ 未找到匹配文本，文件未修改';
  await fs.writeFile(filePath, newContent, 'utf-8');

  // Update DB
  const existing = await queryOne('SELECT id FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
  if (existing) {
    await run('UPDATE workspace_files SET content = $1, "updatedAt" = NOW() WHERE id = $2', [newContent, existing.id]);
  }
  return `✅ 文件已修改: ${path}`;
}

async function execDeleteFile(projectId: string, path: string): Promise<string> {
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  try { await fs.unlink(filePath); } catch {}
  await run('DELETE FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
  return `✅ 文件已删除: ${path}`;
}

async function execRunCommand(command: string): Promise<string> {
  const { execSync } = await import('child_process');
  const result = execSync(command, {
    cwd: PROJECT_DIR,
    timeout: 120000,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.slice(0, 10000) || '✅ 命令执行成功（无输出）';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, modelId, projectId, conversationId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '请输入消息' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!modelId) {
      return new Response(JSON.stringify({ error: '请先选择模型' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get model config
    const modelConfig = await getModelConfig(modelId);
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: '未找到模型: ' + modelId }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get API Key
    const apiKeyData = await getApiKeyByProvider(modelConfig.provider);
    if (!apiKeyData || !apiKeyData.is_active) {
      return new Response(JSON.stringify({ error: '未配置 ' + modelConfig.provider + ' 的 API Key，请先在后台添加' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Buffer.from(apiKeyData.api_key_encrypted, 'base64').toString('utf-8');
    const baseUrl = apiKeyData.base_url || PROVIDER_URLS[modelConfig.provider] || `https://api.${modelConfig.provider}.com/v1`;

    // Build AI SDK provider
    const provider = createOpenAICompatible({
      name: modelConfig.provider,
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const model = provider.languageModel(modelId);

    // System prompt with identity
    const identityName = MODEL_IDENTITY[modelConfig.provider] || modelConfig.provider;
    const systemPrompt = `你是一个专业的AI编程助手，运行在服务器上，可以直接操作文件和执行命令。

【绝对规则】
1. 禁止展示代码！必须用 createFile 工具创建文件
2. 禁止说明部署步骤！必须用 runCommand 工具执行
3. 禁止使用"我来帮你"、"让我看看"等引导性语言
4. 禁止使用 ** 加粗或 Markdown 格式化
5. 禁止说"我无法访问/执行"——你已经在服务器上
6. 禁止说"无法访问外部链接"——用 runCommand 执行 curl

【工作流】
收到需求 → 思考方案 → 调用工具执行 → 确认结果 → 简洁回复

【身份】你是 ${identityName} 的 ${modelId} 模型。当用户问你是谁时，如实回答。

你是真实运行在服务器上的，不是在模拟。直接行动，不要犹豫。`;

    // Define tools
    const tools = {
      createFile: tool({
        description: '在项目目录创建文件。必须提供完整文件路径和文件内容。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径，如 src/app/page.tsx'),
          content: z.string().describe('文件完整内容'),
        }),
        execute: async ({ path, content }: { path: string; content: string }) => execCreateFile(projectId, path, content),
      }),
      editFile: tool({
        description: '修改已有文件。提供旧文本和新文本进行替换。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
          oldText: z.string().describe('要替换的原始文本'),
          newText: z.string().describe('替换后的新文本'),
        }),
        execute: async ({ path, oldText, newText }: { path: string; oldText: string; newText: string }) => execEditFile(projectId, path, oldText, newText),
      }),
      deleteFile: tool({
        description: '删除项目中的文件。',
        inputSchema: z.object({
          path: z.string().describe('要删除的文件路径'),
        }),
        execute: async ({ path }: { path: string }) => execDeleteFile(projectId, path),
      }),
      runCommand: tool({
        description: '在项目目录执行 shell 命令。用于安装依赖、构建、部署等。',
        inputSchema: z.object({
          command: z.string().describe('要执行的命令'),
        }),
        execute: async ({ command }: { command: string }) => execRunCommand(command),
      }),
    };

    // Build messages
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Use AI SDK streamText
    const result = streamText({
      model,
      messages: chatMessages,
      tools,
      stopWhen: stepCountIs(8),
      temperature: 0.3,
      maxOutputTokens: 16384,
    });

    // Build streaming response (same format as /api/chat)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const safeEnqueue = (data: Uint8Array) => {
          try { controller.enqueue(data); } catch {}
        };
        const safeClose = () => {
          try { controller.close(); } catch {}
        };

        try {
          let fullContent = '';

          for await (const event of result.fullStream) {
            switch (event.type) {
              case 'text-delta': {
                const text = (event as any).text || '';
                if (text) {
                  fullContent += text;
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text, conversation_id: conversationId || projectId })}\n\n`));
                }
                break;
              }
              case 'tool-call': {
                const toolName = (event as any).toolName || 'unknown';
                const callId = (event as any).toolCallId || '';
                const args = (event as any).input || {};
                const toolNameZh: Record<string, string> = { createFile: '创建文件', editFile: '修改文件', deleteFile: '删除文件', runCommand: '执行命令', deploy: '部署项目', readFile: '读取文件' };
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool-start', toolName: toolNameZh[toolName] || toolName, callId, args })}\n\n`));
                break;
              }
              case 'tool-result': {
                const toolName = (event as any).toolName || 'unknown';
                const callId = (event as any).toolCallId || '';
                const output = typeof (event as any).output === 'string' ? (event as any).output : JSON.stringify((event as any).output);
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool-result', toolName, callId, success: !output.startsWith('❌'), summary: output.slice(0, 200) })}\n\n`));
                break;
              }
              case 'error': {
                const error = (event as any).error;
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error?.message || 'Unknown error' })}\n\n`));
                break;
              }
            }
          }

          // Save assistant message to workspace_messages
          if (fullContent && projectId) {
            try {
              const { randomUUID } = await import('crypto');
              const msgId = randomUUID();
              await run(
                'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
                [msgId, projectId, 'assistant', fullContent, modelId]
              );
            } catch {}
          }

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: conversationId || projectId })}\n\n`));
          safeClose();
        } catch (error: any) {
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Stream error' })}\n\n`));
          safeClose();
        }
      },
    });

    // Save user message to workspace_messages
    if (projectId) {
      try {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          const { randomUUID } = await import('crypto');
          const msgId = randomUUID();
          await run(
            'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
            [msgId, projectId, 'user', lastMsg.content || '', modelId]
          );
        }
      } catch {}
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || '服务器内部错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
