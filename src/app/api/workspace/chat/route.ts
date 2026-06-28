import { NextRequest } from 'next/server';
import { streamText, isLoopFinished, tool, wrapLanguageModel, extractReasoningMiddleware, LanguageModelMiddleware } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { query, queryOne, run, getSetting } from '@/lib/db';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createSubAgentTool } from '@/lib/sub-agents';
import { describeImages } from '@/lib/vision-proxy';

const execAsync = promisify(exec);

const SYSTEM_PROMPT_FILE = join(process.cwd(), 'system-prompt.md');

// 从数据库读取 system prompt，fallback 到文件
async function loadSystemPrompt(): Promise<string> {
  try {
    const dbPrompt = await getSetting('system_prompt');
    if (dbPrompt && dbPrompt.trim()) return dbPrompt.trim();
  } catch (e) {
    console.error('[loadSystemPrompt] DB read error:', e);
  }
  try {
    return readFileSync(SYSTEM_PROMPT_FILE, 'utf-8').trim();
  } catch {
    return '你是AI编程搭档，能直接操作服务器。收到任务后立即执行，做完总结结果。';
  }
}

// 保存 system prompt 到数据库和文件
async function saveSystemPrompt(prompt: string): Promise<void> {
  try {
    await run(
      `INSERT INTO settings (key, value, "updatedAt") VALUES ('system_prompt', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, "updatedAt" = NOW()`,
      [prompt]
    );
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

const PROJECT_DIR = process.env.PROJECT_DIR || '/www/wwwroot/agent.piyiguo.com';

// Provider URL mappings
const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  moonshot: 'https://api.moonshot.cn/v1',
  kimi: 'https://api.moonshot.cn/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  groq: 'https://api.groq.com/openai/v1',
  yi: 'https://api.lingyiwanwu.com/v1',
  baidu: 'https://qianfan.baidubce.com/v2',
  spark: 'https://spark-api-open.xf-yun.com/v1',
  minimax: 'https://api.minimax.chat/v1',
  meta: 'https://api.together.xyz/v1',
  mistral: 'https://api.mistral.ai/v1',
  cohere: 'https://api.cohere.ai/v1',
};

const MODEL_IDENTITY: Record<string, string> = {
  deepseek: 'DeepSeek 深度求索',
  zhipu: '智谱AI (GLM)',
  qwen: '通义千问 (Qwen)',
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  moonshot: 'Kimi 月之暗面',
  kimi: 'Kimi 月之暗面',
  doubao: '豆包 (Doubao)',
  groq: 'Groq (Llama)',
  yi: '零一万物 (Yi)',
};

// ============ 日志中间件（AI SDK 原生 Middleware） ============
const loggingMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate, model }) => {
    const startTime = Date.now();
    console.log(`[AI] ${model.modelId} request started`);
    const result = await doGenerate();
    const duration = Date.now() - startTime;
    console.log(`[AI] ${model.modelId} completed in ${duration}ms`);
    return result;
  },
  wrapStream: async ({ doStream, model }) => {
    const startTime = Date.now();
    console.log(`[AI] ${model.modelId} stream started`);
    const result = await doStream();
    const duration = Date.now() - startTime;
    console.log(`[AI] ${model.modelId} stream completed in ${duration}ms`);
    return result;
  },
};

// ============ 工具执行函数 (workspace: 操作 workspace_files DB + 服务器文件系统) ============
async function execCreateFile(projectId: string, path: string, content: string): Promise<string> {
  const { randomUUID } = await import('crypto');
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  await fs.mkdir(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
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
    return `❌ 读取文件失败: ${path} - ${e.message || '文件不存在或无法读取'}`;
  }
}

// ============ 联网搜索 (Bing) ============
async function execSearchWeb(query: string): Promise<string> {
  try {
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&count=8&cc=cn';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    const html = await res.text();
    const results: string[] = [];
    const titleMatches = html.matchAll(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/g);
    let count = 0;
    for (const m of titleMatches) {
      if (count >= 8) break;
      const title = m[1].replace(/<[^>]+>/g, '').trim();
      if (title && title.length > 2 && !title.includes('Microsoft') && !title.includes('Bing')) {
        count++;
        results.push(count + '. ' + title);
      }
    }
    if (results.length > 0) return '搜索结果（' + query + '）：\n' + results.join('\n');
    return '未找到搜索结果，请尝试换个关键词';
  } catch (e: any) {
    return '搜索失败: ' + (e.message || '未知错误');
  }
}

// ============ 持久记忆 ============
async function getMemories(): Promise<string> {
  try {
    const db = await import('@/lib/db');
    const rows = await db.query('SELECT category, content FROM user_memory ORDER BY "updatedAt" DESC');
    if (!rows || rows.length === 0) return '';
    const grouped: Record<string, string[]> = {};
    for (const r of rows) {
      const cat = r.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r.content);
    }
    const parts: string[] = [];
    for (const [cat, items] of Object.entries(grouped)) {
      parts.push(cat + ': ' + items.join('; '));
    }
    return parts.join('\n');
  } catch { return ''; }
}

async function execSaveMemory(category: string, content: string): Promise<string> {
  try {
    const db = await import('@/lib/db');
    const id = 'mem_' + Date.now();
    await db.run('INSERT INTO user_memory (id, category, content, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())', [id, category, content]);
    return '✅ 已记住: [' + category + '] ' + content;
  } catch (e: any) {
    return '❌ 记忆保存失败: ' + (e.message || '未知错误');
  }
}

// ============ Workspace 模式工具集 ============
const MODE_TOOLS: Record<string, string[]> = {
  coding: ['createFile', 'editFile', 'deleteFile', 'readFile', 'runCommand', 'searchWeb', 'saveMemory', 'delegate_task'],
  writing: ['searchWeb', 'saveMemory', 'delegate_task'],
  analysis: ['searchWeb', 'saveMemory', 'delegate_task'],
  design: ['saveMemory'],
  chat: ['searchWeb', 'saveMemory', 'delegate_task'],
};

// ============ 加载增强工具（安全加载，失败不影响核心功能） ============
let enhancedTools: Record<string, any> = {};
try { const { memoryTools } = await import('@/lib/memory-tools'); Object.assign(enhancedTools, memoryTools); } catch {}
try { const { workflowTools } = await import('@/lib/ai-workflows'); Object.assign(enhancedTools, workflowTools); } catch {}
try { const { subAgentTools } = await import('@/lib/sub-agents'); Object.assign(enhancedTools, subAgentTools); } catch {}
try { const { imageTools } = await import('@/lib/image-generation'); Object.assign(enhancedTools, imageTools); } catch {}

// MCP 工具
let mcpToolsMap: Record<string, any> = {};
try {
  const { mcpManager } = await import('@/lib/mcp-client');
  mcpToolsMap = await mcpManager.getAllTools();
} catch {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages: rawMessages, modelId, projectId, conversationId, mode: rawMode, enable_search } = body as {
      messages: any[];
      modelId: string;
      projectId: string;
      conversationId?: string;
      mode?: string;
      enable_search?: boolean;
    };
    const mode = rawMode || 'coding';

    if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: '请输入消息' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!modelId) {
      return new Response(JSON.stringify({ error: '请先选择模型' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取模型配置
    const modelConfig = await getModelConfig(modelId);
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: '未找到模型: ' + modelId }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取 API Key
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

    // UIMessage parts → content string 转换
    const messages = (rawMessages || []).map((m: any) => {
      if (m.parts && !m.content) {
        const text = (m.parts as any[])
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text || '')
          .join('');
        return { role: m.role, content: text };
      }
      return m;
    });

    // System prompt
    const identityName = MODEL_IDENTITY[modelConfig.provider] || modelConfig.provider;
    const systemPrompt = await loadSystemPrompt();
    const memories = await getMemories();
    const memorySection = memories ? '\n\n【用户记忆】\n' + memories + '\n\n当用户提到与记忆相关的内容时，参考这些信息。用户说"记住"时，用 saveMemory 工具保存。' : '';
    const fullSystemPrompt = systemPrompt + memorySection + `\n\n【身份】你是 ${identityName} 的 ${modelId} 模型。当用户问你是谁时，如实回答。`;

    // Filter out system messages (AI SDK v7 uses system option)
    const userAssistantMessages = messages.filter((m: any) => {
      const role = String(m.role || '').toLowerCase().trim();
      return role !== 'system' && role !== 'developer' && role !== 'tool';
    }).map((m: any) => {
      // Extract text content from parts if available (AI SDK multimodal)
      const parts = m.parts || [];
      const imageParts = parts.filter((p: any) => p.type === 'file' && p.data);
      const textParts = parts.filter((p: any) => p.type === 'text');
      
      let textContent = '';
      if (textParts.length > 0) {
        textContent = textParts.map((p: any) => p.text || '').join('');
      } else {
        textContent = typeof m.content === 'string' ? m.content : '';
      }
      
      // Strip any [image:...] markers from text
      textContent = textContent.replace(/\[image:[\s\S]*?\]/g, '').trim();
      
      return {
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: textContent || '',
        _imageParts: imageParts,
      } as any;
    });

        // Process images from messages (vision proxy for non-multimodal models)
    const MULTIMODAL_PROVIDERS = ['openai', 'anthropic', 'google', 'qwen', 'zhipu'];
    const MULTIMODAL_MODEL_ORDER = ['gpt-4o', 'gpt-4.1', 'gemini-2.5-pro', 'gemini-2.5-flash', 'qwen-max', 'qwen-plus', 'claude-sonnet-4-5', 'glm-4.5-flash', 'glm-5.2'];
    const supportsMultimodal = MULTIMODAL_PROVIDERS.includes(modelConfig.provider) || MULTIMODAL_MODEL_ORDER.some(m => modelId.includes(m));
    
    for (const msg of userAssistantMessages) {
      if (msg._imageParts && msg._imageParts.length > 0) {
        if (supportsMultimodal) {
          // For multimodal models, convert to file parts
          const fileParts = msg._imageParts.map((p: any) => ({
            type: 'file' as const,
            data: p.data,
            mediaType: p.mediaType || 'image/png',
          }));
          msg.content = [
            { type: 'text' as const, text: msg.content },
            ...fileParts,
          ];
        } else {
          // For non-multimodal models, use vision proxy to describe images
          try {
            const images = msg._imageParts.map((p: any) => ({
              base64Data: p.data,
              mediaType: p.mediaType || 'image/png',
            }));
            const description = await describeImages(images, msg.content || undefined);
            msg.content = msg.content ? msg.content + '\n\n' + description : description;
          } catch (e: any) {
            msg.content = msg.content ? msg.content + '\n\n[图片识别失败: ' + e.message + ']' : '[图片识别失败]';
          }
        }
      }
      // Remove internal property before sending to AI
      delete msg._imageParts;
    }

    // 读取高级配置
    let maxSteps = 20;
    const WS_PROVIDER_MAX_TOKENS: Record<string, number> = {
      deepseek: 8192, groq: 8192, moonshot: 8192, zhipu: 4096,
    };
    let wsMaxOutputTokens = WS_PROVIDER_MAX_TOKENS[modelConfig.provider] || 16384;
    let wsTopP: number | undefined = undefined;
    let temperature: number | undefined = undefined;

    try {
      const advStr = await getSetting('advanced_config');
      if (advStr) {
        const adv = JSON.parse(advStr);
        if (adv.max_steps !== undefined) maxSteps = adv.max_steps;
        if (adv.max_output_tokens !== undefined) wsMaxOutputTokens = Math.min(adv.max_output_tokens, WS_PROVIDER_MAX_TOKENS[modelConfig.provider] || 65536);
        if (adv.topP !== undefined && adv.topP !== 0.9) wsTopP = adv.topP;
      }
    } catch {}
    // Reasoning models need more steps
    const isReasoningModel = modelId.includes('deepseek-v4-pro') || modelId.includes('o3') || modelId.includes('o4');
    if (isReasoningModel && maxSteps < 15) maxSteps = 15;

    try {
      const tempStr = await getSetting('mode_temperatures');
      if (tempStr) {
        const temps = JSON.parse(tempStr);
        if (temps[mode] !== undefined) temperature = temps[mode];
      }
    } catch {}

    if (temperature === undefined) {
      const defaultTemps: Record<string, number> = { coding: 0, writing: 0.7, analysis: 0.1, design: 0.3, chat: 0.5 };
      temperature = defaultTemps[mode] ?? 0.3;
    }

    // 定义 workspace 工具（闭包引用 projectId）
    const tools = {
      createFile: tool({
        description: '在项目目录创建文件。必须提供完整文件路径和文件内容。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径，如 src/app/page.tsx'),
          content: z.string().describe('文件完整内容'),
        }),
        execute: async ({ path, content }: { path: string; content: string }) =>
          execCreateFile(projectId, path, content),
      }),
      editFile: tool({
        description: '修改已有文件。提供旧文本和新文本进行替换。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
          oldText: z.string().describe('要替换的原始文本'),
          newText: z.string().describe('替换后的新文本'),
        }),
        execute: async ({ path, oldText, newText }: { path: string; oldText: string; newText: string }) =>
          execEditFile(projectId, path, oldText, newText),
      }),
      deleteFile: tool({
        description: '删除项目中的文件。',
        inputSchema: z.object({
          path: z.string().describe('要删除的文件路径'),
        }),
        execute: async ({ path }: { path: string }) =>
          execDeleteFile(projectId, path),
      }),
      runCommand: tool({
        description: '在项目目录执行 shell 命令。用于安装依赖、构建、部署等。',
        inputSchema: z.object({
          command: z.string().describe('要执行的命令'),
        }),
        execute: async ({ command }: { command: string }) =>
          execRunCommand(command),
      }),
      readFile: tool({
        description: '读取项目中的文件内容。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
        }),
        execute: async ({ path }: { path: string }) =>
          execReadFile(path),
      }),
      searchWeb: tool({
        description: '搜索互联网获取实时信息。用于查询最新新闻、价格、技术文档等。',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
        }),
        execute: async ({ query }: { query: string }) =>
          execSearchWeb(query),
      }),
      saveMemory: tool({
        description: '保存记忆到长期存储。当用户说记住或提到重要偏好、项目信息时使用。',
        inputSchema: z.object({
          category: z.string().describe('分类：preference/project/fact/note'),
          content: z.string().describe('要记住的内容'),
        }),
        execute: async ({ category, content }: { category: string; content: string }) =>
          execSaveMemory(category, content),
      }),
    };

    // 合并工具：基础工具 + 增强工具 + MCP工具，按 MODE_TOOLS 过滤
    const baseToolNames = MODE_TOOLS[mode] || [];
    const activeTools: Record<string, any> = {};
    for (const name of baseToolNames) {
      if (tools[name as keyof typeof tools]) activeTools[name] = tools[name as keyof typeof tools];
    }
    // 添加增强工具（仅限当前模式允许的工具）
    for (const name of Object.keys(enhancedTools)) {
      if (baseToolNames.includes(name)) activeTools[name] = enhancedTools[name];
    }
    // 添加 MCP 工具（仅限当前模式允许的工具）
    for (const name of Object.keys(mcpToolsMap)) {
      if (baseToolNames.includes(name)) activeTools[name] = mcpToolsMap[name];
    }

    // 联网搜索开关：关闭时移除 searchWeb 工具
    if (enable_search === false) {
      delete activeTools.searchWeb;
    }

    // 子智能体工具（AI SDK 原生 ToolLoopAgent）
    if (baseToolNames.includes('delegate_task')) {
      activeTools.delegate_task = createSubAgentTool(model, activeTools);
    }

    // ====== AI SDK v7 原生 Middleware + Telemetry ======
    const streamStartTime = Date.now();
    const wrappedModel = wrapLanguageModel({
      model,
      middleware: [
        loggingMiddleware,
        extractReasoningMiddleware({ tagName: 'think' }),
      ],
    });

    const result = streamText({
      system: fullSystemPrompt,
      model: wrappedModel,
      messages: userAssistantMessages as any,
      tools: Object.keys(activeTools).length > 0 ? activeTools : undefined,
      stopWhen: isLoopFinished(),
      temperature,
      maxOutputTokens: wsMaxOutputTokens,
      ...(wsTopP !== undefined && { topP: wsTopP }),
      telemetry: {
        isEnabled: true,
        functionId: 'workspace-chat-completion',
      },
      abortSignal: request.signal,
    });

    // 保存用户消息到 workspace_messages
    if (projectId) {
      try {
        const lastMsg = rawMessages[rawMessages.length - 1];
        if (lastMsg) {
          const userContent = lastMsg.content ||
            ((lastMsg.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join(''));
          if (userContent) {
            const { randomUUID } = await import('crypto');
            const msgId = randomUUID();
            await run(
              'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
              [msgId, projectId, 'user', userContent, modelId]
            );
          }
        }
      } catch {}
    }

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      // 通过 messageMetadata 将 projectId 传给前端
      messageMetadata: ({ part }) => {
        if (part.type === 'start' || part.type === 'finish') {
          return { conversationId: conversationId || projectId } as any;
        }
        return undefined;
      },
      // 流结束后保存助手消息 + 触发文件刷新
      async onEnd({ responseMessage: message, isAborted }) {
        try {
          const text = (message as any).text
            || (message.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');

          // 从 message parts 提取工具执行记录
          const toolParts = (message.parts || []).filter(
            (p: any) => p.type?.startsWith('tool-') && p.toolInvocation?.state === 'output-available'
          );
          let savedContent = text;
          if (toolParts.length > 0) {
            const execLog = toolParts.map((tp: any, i: number) => {
              const name = tp.toolName || 'unknown';
              const out = typeof tp.toolInvocation.output === 'string' ? tp.toolInvocation.output : JSON.stringify(tp.toolInvocation.output);
              return `${i + 1}. ${name}: ${out.startsWith('❌') ? '❌' : '✅'} ${out.slice(0, 100)}`;
            }).join('\n');
            savedContent = text + '\n\n<!--EXEC_LOG\n' + execLog + '\n-->';
          }

          if (text && !isAborted && projectId) {
            const { randomUUID } = await import('crypto');
            const msgId = randomUUID();
            await run(
              'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
              [msgId, projectId, 'assistant', savedContent, modelId]
            );
          }
        } catch (e) {
          console.error('[workspace/chat onEnd] save error:', e);
        }

        // Telemetry (ai_telemetry 表)
        try {
          const { telemetry } = await import('@/lib/ai-telemetry');
          telemetry.recordAICall({
            provider: modelConfig.provider, model: modelId,
            operation: 'workspace_chat_stream', durationMs: Date.now() - streamStartTime, success: true,
          });
        } catch {}

        // 记录到 telemetry_events 表（AI SDK 原生 Telemetry 补充）
        try {
          const { recordTelemetry } = await import('@/lib/telemetry');
          await recordTelemetry({
            functionId: 'workspace-chat-completion',
            model: modelId,
            mode: mode,
            durationMs: Date.now() - streamStartTime,
            status: 'success',
          });
        } catch {}

        // Close MCP
        try { const { mcpManager } = await import('@/lib/mcp-client'); await mcpManager.closeAll(); } catch {}
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || '服务器内部错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
