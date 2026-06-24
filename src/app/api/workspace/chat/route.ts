import { NextRequest } from 'next/server';
import { streamText, type ModelMessage, zodSchema } from 'ai';
import { z } from 'zod';
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
  if (!attachments || attachments.length === 0) return text;
  const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];
  if (text) parts.push({ type: 'text', text });
  for (const att of attachments) {
    if (att.type === 'image' && att.mimeType.startsWith('image/')) {
      parts.push({ type: 'image', image: att.url });
    } else {
      let fileContent = att.content || '';
      if (!fileContent && att.url) {
        try {
          const match = att.url.match(/^data:[^;]+;base64,(.+)$/);
          if (match) fileContent = Buffer.from(match[1], 'base64').toString('utf-8');
        } catch { fileContent = '(无法解码文件内容)'; }
      }
      if (fileContent) {
        parts.push({ type: 'text', text: '\n--- 附件: ' + att.name + ' ---\n' + fileContent + '\n--- 附件结束 ---\n' });
      }
    }
  }
  return parts.length > 0 ? parts : text;
}

async function findApiKey(provider: string) {
  let apiKey = await prisma.apiKey.findFirst({ where: { provider, isActive: true } });
  if (apiKey) return apiKey;
  const aliases = PROVIDER_ALIASES[provider] || [];
  for (const alias of aliases) {
    apiKey = await prisma.apiKey.findFirst({ where: { provider: alias, isActive: true } });
    if (apiKey) return apiKey;
  }
  return null;
}

const WORKSPACE_SYSTEM_PROMPT = '你是一个专业的 AI 编程助手，运行在 AI 编程工作区中。你可以直接操作项目文件。\n\n你的核心能力：\n1. **创建文件** — 使用 createFile 工具创建新文件或覆盖已有文件\n2. **修改文件** — 使用 editFile 工具精确替换文件中的代码片段\n3. **删除文件** — 使用 deleteFile 工具删除不需要的文件\n4. **执行命令** — 使用 runCommand 工具执行终端命令（如安装依赖、运行脚本）\n\n工作方式：\n- 用户用自然语言描述需求，你理解后直接动手实现\n- 优先使用 editFile 精确修改，只有创建全新文件时用 createFile\n- 每次操作前简要说明你要做什么，操作后确认结果\n- 如果需要安装依赖包，使用 runCommand 执行 npm install\n- 修改多个文件时，按逻辑顺序依次操作\n\n注意事项：\n- 修改代码前确保理解现有代码结构\n- editFile 的 oldContent 必须与文件中已有内容完全一致（包括缩进）\n- 如果不确定文件当前内容，先读取文件再修改\n- 一次对话中可以多次调用工具，直到任务完成\n- 保持专业、友好，提供高质量代码';

// Helper to fix zodSchema for AI SDK v6 + Zod v4 compatibility

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, modelId, projectId, files } = body;

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

    let modelConfig = getModelById(modelId);
    if (!modelConfig) {
      const dbConfig = await prisma.modelConfig.findFirst({ where: { modelId: modelId, isActive: true } });
      if (dbConfig) modelConfig = { id: dbConfig.modelId, name: dbConfig.name, provider: dbConfig.provider };
    }
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: '未找到模型: ' + modelId }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = await findApiKey(modelConfig.provider);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '未配置 ' + modelConfig.provider + ' 的 API Key，请先在后台添加' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let model;
    try {
      model = getModelByProvider(modelConfig.provider, modelConfig.id, decodeApiKey(apiKey.apiKey));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: '创建模型失败: ' + msg }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let systemPrompt = WORKSPACE_SYSTEM_PROMPT;
    if (files && Object.keys(files).length > 0) {
      systemPrompt += '\n\n当前项目文件：\n';
      for (const [path, content] of Object.entries(files)) {
        systemPrompt += '\n--- ' + path + ' ---\n' + content + '\n';
      }
    }

    const aiMessages: ModelMessage[] = messages.map(
      (m: { role: string; content: string; attachments?: AttachmentPayload[] }, index: number) => {
        if (index === messages.length - 1 && m.attachments && m.attachments.length > 0) {
          return { role: m.role as 'user' | 'assistant' | 'system', content: buildMessageContent(m.content, m.attachments) } as ModelMessage;
        }
        return { role: m.role as 'user' | 'assistant' | 'system', content: m.content } as ModelMessage;
      }
    );

    const chatMessages: ModelMessage[] = [...aiMessages];

    // Define tools for workspace chat
    const createFileTool = {
      description: '创建新文件或覆盖已有文件。path 是相对于项目根目录的路径，content 是完整的文件内容。',
      inputSchema: zodSchema(z.object({
        path: z.string().describe('文件路径，如 src/components/Button.tsx'),
        content: z.string().describe('文件完整内容'),
      })),
      execute: async ({ path, content }: { path: string; content: string }) => {
        try {
          const existing = await prisma.workspaceFile.findFirst({ where: { projectId, path } });
          if (existing) {
            await prisma.workspaceFile.update({ where: { id: existing.id }, data: { content, updatedAt: new Date() } });
            return { success: true, action: 'updated', path, fileId: existing.id };
          }
          const name = path.split('/').pop() || path;
          const file = await prisma.workspaceFile.create({ data: { projectId, path, name, type: 'file', content } });
          return { success: true, action: 'created', path, fileId: file.id };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },
    };

    const editFileTool = {
      description: '精确修改文件中的代码片段。oldContent 必须与文件中已有内容完全一致（包括缩进和换行），newContent 是替换后的内容。适合局部修改，不要传整个文件内容。',
      inputSchema: zodSchema(z.object({
        path: z.string().describe('要修改的文件路径'),
        oldContent: z.string().describe('要被替换的原始代码片段（必须与文件内容完全一致）'),
        newContent: z.string().describe('替换后的新代码片段'),
      })),
      execute: async ({ path, oldContent, newContent }: { path: string; oldContent: string; newContent: string }) => {
        try {
          const file = await prisma.workspaceFile.findFirst({ where: { projectId, path } });
          if (!file) return { success: false, error: '文件不存在: ' + path };

          const normalizeEndings = (s: string) => s.replace(/\r\n/g, '\n');
          const normalizedContent = normalizeEndings(file.content);
          const normalizedOld = normalizeEndings(oldContent);

          if (!normalizedContent.includes(normalizedOld)) {
            return { success: false, error: '未找到匹配内容。请确认 oldContent 与文件中内容完全一致。文件前200字符: ' + file.content.slice(0, 200) };
          }

          const newFileContent = normalizedContent.replace(normalizedOld, normalizeEndings(newContent));
          await prisma.workspaceFile.update({ where: { id: file.id }, data: { content: newFileContent, updatedAt: new Date() } });
          return { success: true, action: 'edited', path, fileId: file.id };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },
    };

    const deleteFileTool = {
      description: '删除项目中的文件。',
      inputSchema: zodSchema(z.object({
        path: z.string().describe('要删除的文件路径'),
      })),
      execute: async ({ path }: { path: string }) => {
        try {
          const file = await prisma.workspaceFile.findFirst({ where: { projectId, path } });
          if (!file) return { success: false, error: '文件不存在: ' + path };
          await prisma.workspaceFile.delete({ where: { id: file.id } });
          return { success: true, action: 'deleted', path };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },
    };

    const runCommandTool = {
      description: '执行终端命令，如安装依赖、运行脚本等。命令在服务器端执行，有30秒超时限制。',
      inputSchema: zodSchema(z.object({
        command: z.string().describe('要执行的命令，如 npm install axios'),
      })),
      execute: async ({ command }: { command: string }) => {
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          const dangerous = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', ':(){:|&};:'];
          if (dangerous.some(dc => command.includes(dc))) {
            return { success: false, error: '危险命令已被阻止' };
          }

          const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 1024 * 1024 });
          return { success: true, output: (stdout || stderr || '命令执行成功').slice(0, 5000), exitCode: stderr ? 1 : 0 };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, output: msg.slice(0, 5000), exitCode: 1 };
        }
      },
    };

    const tools = {
      createFile: createFileTool,
      editFile: editFileTool,
      deleteFile: deleteFileTool,
      runCommand: runCommandTool,
    };

    let result;
    try {
      result = streamText({
        model,
        system: systemPrompt,
        messages: chatMessages,
        tools,
        maxSteps: 10,
        maxOutputTokens: 8192,
        temperature: 0.7,
      } as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: 'AI 调用失败: ' + msg }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (projectId) {
      prisma.workspaceMessage.create({
        data: { role: 'user', content: lastMessage?.content || '', conversationId: projectId, modelId },
      }).catch(() => {});
    }

    const response = result.toUIMessageStreamResponse();
    const [streamForClient, streamForSave] = response.body!.tee();

    if (projectId) {
      (async () => {
        try {
          const reader = streamForSave.getReader();
          const decoder = new TextDecoder();
          let fullText = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('0:')) {
                try {
                  const textDelta = JSON.parse(line.slice(2));
                  if (typeof textDelta === 'string') fullText += textDelta;
                } catch {}
              }
            }
          }
          if (fullText) {
            await prisma.workspaceMessage.create({
              data: { role: 'assistant', content: fullText, conversationId: projectId, modelId },
            });
          }
        } catch (error) {
          console.error('[Workspace Chat] Save error:', error);
        }
      })();
    }

    return new Response(streamForClient, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Workspace Chat] API error:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误，请稍后重试' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
