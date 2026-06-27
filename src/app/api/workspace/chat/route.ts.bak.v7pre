import { NextRequest } from 'next/server';
import { streamText, isStepCount } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { tool } from 'ai';
import { query, queryOne, run, getSetting } from '@/lib/db';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { join } from 'path';
import { writeFileSync } from 'fs';
const execAsync = promisify(exec);

const SYSTEM_PROMPT_FILE = join(process.cwd(), 'system-prompt.md');

// 从数据库读取 system prompt，fallback 到文件
async function loadSystemPrompt(): Promise<string> {
  try {
    // 优先从数据库读取
    const dbPrompt = await getSetting('system_prompt');
    if (dbPrompt && dbPrompt.trim()) return dbPrompt.trim();
  } catch (e) {
    console.error('[loadSystemPrompt] DB read error:', e);
  }
  
  // fallback 到文件
  try {
    return readFileSync(SYSTEM_PROMPT_FILE, 'utf-8').trim();
  } catch {
    return '你是AI编程搭档，能直接操作服务器。收到任务后立即执行，做完总结结果。';
  }
}

// 保存 system prompt 到数据库和文件
async function saveSystemPrompt(prompt: string): Promise<void> {
  try {
    // 保存到数据库
    await run(
      `INSERT INTO settings (key, value, "updatedAt") VALUES ('system_prompt', , NOW())
       ON CONFLICT (key) DO UPDATE SET value = , "updatedAt" = NOW()`,
      [prompt]
    );
    
    // 同步到文件
    try {
      writeFileSync(SYSTEM_PROMPT_FILE, prompt, 'utf-8');
    } catch (fileErr) {
      console.error('[saveSystemPrompt] File write error:', fileErr);
    }
  } catch (e) {
    console.error('[saveSystemPrompt] Error:', e);
    throw e;
  }
}

const PROJECT_DIR = '/www/wwwroot/agent.piyiguo.com';

// Provider URL mappings (默认 fallback)
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

  // Save to DB (with error handling)
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

  // Upsert DB
  try {
    const existing = await queryOne('SELECT id FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
    if (existing) {
      await run('UPDATE workspace_files SET content = $1, "updatedAt" = NOW() WHERE id = $2', [newContent, existing.id]);
    } else {
      const { randomUUID } = await import('crypto');
      const id = randomUUID();
      const name = path.split('/').pop() || path;
      await run(
        'INSERT INTO workspace_files (id, "projectId", name, path, content, type, "updatedAt") VALUES ($1, $2, $3, $4, $5, \'file\', NOW())',
        [id, projectId, name, path, newContent]
      );
    }
  } catch (dbErr: any) {
    console.error('[execEditFile] DB error:', dbErr.message);
  }
  return `✅ 文件已修改: ${path}`;
}

async function execDeleteFile(projectId: string, path: string): Promise<string> {
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  try { await fs.unlink(filePath); } catch {}
  try {
    await run('DELETE FROM workspace_files WHERE "projectId" = $1 AND path = $2', [projectId, path]);
  } catch (dbErr: any) {
    console.error('[execDeleteFile] DB error:', dbErr.message);
  }
  return `✅ 文件已删除: ${path}`;
}

async function execRunCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: PROJECT_DIR,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = (stdout || '') + (stderr ? '\n[stderr] ' + stderr : '');
    return output.slice(0, 10000) || '✅ 命令执行成功（无输出）';
  } catch (e: any) {
    const errMsg = e.stderr?.slice(0, 500) || e.stdout?.slice(0, 500) || e.message || '未知错误';
    return `❌ 命令执行失败: ${errMsg}`;
  }
}

async function execReadFile(path: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const filePath = `${PROJECT_DIR}/${path}`;
    const content = await fs.readFile(filePath, 'utf-8');
    return content.slice(0, 50000);
  } catch (e: any) {
    return `❌ 读取文件失败: ${e.message || '文件不存在或无法读取'}`;
  }
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
    // 优先从数据库的 api_keys 表的 base_url 读取，否则 fallback 到硬编码的 PROVIDER_URLS
    const baseUrl = apiKeyData.base_url || PROVIDER_URLS[modelConfig.provider] || `https://api.${modelConfig.provider}.com/v1`;

    // Build AI SDK provider
    const provider = createOpenAICompatible({
      name: modelConfig.provider,
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const model = provider.languageModel(modelId);

    // System prompt with identity (从数据库或 system-prompt.md 动态加载)
    const identityName = MODEL_IDENTITY[modelConfig.provider] || modelConfig.provider;
    const systemPrompt = await loadSystemPrompt();
    const fullSystemPrompt = systemPrompt + `\n\n【身份】你是 ${identityName} 的 ${modelId} 模型。当用户问你是谁时，如实回答。`;

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
      readFile: tool({
        description: '读取项目中的文件内容。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
        }),
        execute: async ({ path }: { path: string }) => execReadFile(path),
      }),
    };

    // Filter system messages from user/assistant messages (AI SDK v7 uses 'system' option)
    const filteredMessages = messages.filter((m: any) => m.role !== 'system');

    // Build messages
    const chatMessages = [
      ...filteredMessages.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Read advanced config for workspace chat too
    let wsMaxOutputTokens = 16384;
    let wsTopP: number | undefined = undefined;
    try {
      const advStr = await getSetting('advanced_config');
      if (advStr) {
        const adv = JSON.parse(advStr);
        if (adv.max_output_tokens !== undefined) wsMaxOutputTokens = adv.max_output_tokens;
        if (adv.topP !== undefined && adv.topP !== 0.9) wsTopP = adv.topP;
      }
    } catch {}

    const wsStreamOptions: any = {
      system: fullSystemPrompt,
      model,
      messages: chatMessages,
      tools,
      stopWhen: isStepCount(8),
      allowSystemInMessages: true,
      temperature: 0.3,
      maxOutputTokens: wsMaxOutputTokens,
    };
    if (wsTopP !== undefined) wsStreamOptions.topP = wsTopP;

    const result = streamText(wsStreamOptions);

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
          const toolCallRecords: Array<{ name: string; status: string; summary: string }> = [];

          for await (const event of result.stream) {
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
                const success = !output.startsWith('❌');
                toolCallRecords.push({ name: toolName, status: success ? 'done' : 'error', summary: output.slice(0, 100) });
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool-result', toolName, callId, success, summary: output.slice(0, 200) })}\n\n`));
                break;
              }
              case 'error': {
                const error = (event as any).error;
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error?.message || 'Unknown error' })}\n\n`));
                break;
              }
            }
          }

          // Save assistant message to workspace_messages with tool execution log
          if (fullContent && projectId) {
            try {
              const { randomUUID } = await import('crypto');
              const msgId = randomUUID();
              let savedContent = fullContent;
              if (toolCallRecords.length > 0) {
                const execLog = toolCallRecords.map((tc, i) => `${i + 1}. ${tc.name}: ${tc.status === 'done' ? '✅' : '❌'} ${tc.summary}`).join('\n');
                savedContent = fullContent + '\n\n<!--EXEC_LOG\n' + execLog + '\n-->';
              }
              await run(
                'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
                [msgId, projectId, 'assistant', savedContent, modelId]
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
