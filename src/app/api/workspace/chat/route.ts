import { NextRequest, NextResponse } from 'next/server';
import { ToolLoopAgent, isStepCount, pruneMessages, streamText, tool, toUIMessageStream, wrapLanguageModel, extractReasoningMiddleware, LanguageModelMiddleware, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
// === 自主智能：SSH工具 + 技能系统 ===
import { serverTools } from '@/lib/server-tools';
import { skillTools, generateSkillsCatalog } from '@/lib/skills';
import { webTools } from '@/lib/web-scraper';
import { previewTools } from '@/lib/preview-tool';
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
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { DEFAULT_MODE_TOOLS, DEFAULT_MODEL_IDENTITY, DEFAULT_WS_PROVIDER_MAX_TOKENS } from '@/lib/config-defaults';

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

const MODEL_IDENTITY: Record<string, string> = await (async () => { try { const r = await getSetting('model_identity'); return r ? { ...DEFAULT_MODEL_IDENTITY, ...JSON.parse(r) } : DEFAULT_MODEL_IDENTITY; } catch { return DEFAULT_MODEL_IDENTITY; } })();;

// ============ 日志中间件（AI SDK 原生 Middleware） ============
const loggingMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate, model }) => {
    const startTime = Date.now();
    logger.info(`[AI] ${model.modelId} request started`);
    const result = await doGenerate();
    const duration = Date.now() - startTime;
    logger.info(`[AI] ${model.modelId} completed in ${duration}ms`);
    return result;
  },
  wrapStream: async ({ doStream, model }) => {
    const startTime = Date.now();
    logger.info(`[AI] ${model.modelId} stream started`);
    const result = await doStream();
    const duration = Date.now() - startTime;
    logger.info(`[AI] ${model.modelId} stream completed in ${duration}ms`);
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

async function execReadFile(path: string, offset?: number, limit?: number): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const filePath = `${PROJECT_DIR}/${path}`;
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;
    const startLine = Math.max(1, offset || 1) - 1;
    const endLine = limit ? Math.min(startLine + limit, totalLines) : totalLines;
    const selectedLines = lines.slice(startLine, endLine);
    const result = selectedLines.map((line, i) => `${startLine + i + 1}\t${line}`).join('\n');
    const header = `[文件: ${path} | 共${totalLines}行 | 显示${startLine + 1}-${endLine}行]`;
    return header + '\n' + result;
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
async function getMemories(userMessage?: string): Promise<string> {
  try {
    const db = await import('@/lib/db');
    const rows = await db.query('SELECT category, content, importance, keywords FROM user_memory ORDER BY importance DESC, "updatedAt" DESC');
    if (!rows || rows.length === 0) return '';
    const parts: string[] = [];
    let totalLen = 0;
    const MAX_MEMORY_CHARS = 2000;
    for (const r of rows) {
      if (r.importance >= 5) {
        const entry = r.category + ': ' + r.content;
        if (totalLen + entry.length > MAX_MEMORY_CHARS) break;
        parts.push(entry);
        totalLen += entry.length;
        continue;
      }
      if (userMessage && r.keywords) {
        const kws = String(r.keywords).split(',').map((k: string) => k.trim()).filter(Boolean);
        const msg = userMessage.toLowerCase();
        if (kws.some(kw => msg.includes(kw.toLowerCase()))) {
          const entry = r.category + ': ' + r.content;
          if (totalLen + entry.length > MAX_MEMORY_CHARS) break;
          parts.push(entry);
          totalLen += entry.length;
        }
      }
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
const modeToolsRaw = await (async () => { try { const r = await getSetting('mode_tool_whitelist'); return r ? JSON.parse(r) : null; } catch { return null; } })();
    const MODE_TOOLS: Record<string, string[]> = modeToolsRaw || DEFAULT_MODE_TOOLS;;

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
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

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
    const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || ''; const memories = await getMemories(typeof lastUserMsg === 'string' ? lastUserMsg : '');
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
    let maxSteps = (await (async () => { try { const r = await getSetting('advanced_config'); return r ? JSON.parse(r).max_steps : 20; } catch { return 20; } })()) || 20;
    const WS_PROVIDER_MAX_TOKENS: Record<string, number> = DEFAULT_WS_PROVIDER_MAX_TOKENS;;
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
        description: '读取文件内容。大文件用 offset 和 limit 参数分段读取，避免超长输出。修改代码前务必先 readFile 了解当前内容，不要猜测。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
          offset: z.number().optional().describe('起始行号，从1开始。默认1'),
          limit: z.number().optional().describe('读取行数。默认全部，建议大文件每次100-200行'),
        }),
        execute: async ({ path, offset, limit }: { path: string; offset?: number; limit?: number }) =>
          execReadFile(path, offset, limit),
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

    // === 自主智能：SSH服务器工具 + 技能工具 ===
    Object.assign(activeTools, serverTools, skillTools, webTools, previewTools);

    // ====== AI SDK v7 原生 Middleware + Telemetry ======
    const streamStartTime = Date.now();
    const wrappedModel = wrapLanguageModel({
      model,
      middleware: [
        loggingMiddleware,
        extractReasoningMiddleware({ tagName: 'think' }),
      ],
    });

    // Step limit safety: prevent infinite tool-calling loops
    let wsStepCount = 0;
    const wsStepAbortController = new AbortController();
    const wsCombinedSignal = AbortSignal.any([request.signal, wsStepAbortController.signal]);

    // AI SDK v7 ToolLoopAgent: official agent loop with stopWhen + prepareStep
    const wsSkillsCatalog = await generateSkillsCatalog();
    const agent = new ToolLoopAgent({
      model: wrappedModel,
      instructions: fullSystemPrompt + (wsSkillsCatalog ? "\n\n" + wsSkillsCatalog : ""),
      tools: Object.keys(activeTools).length > 0 ? activeTools : undefined,
      // AI SDK official toolApproval - dynamic approval based on tool input
      toolApproval: {
        ssh_execute: async (input: any) => {
          const cmd = String(input.command || '').trim();
          if (/^(ls|cat|head|tail|find|grep|pwd|whoami|echo|stat|df|du|free|uptime|ps|netstat|curl|wget|git status|git log|git diff|git branch|node -v|npm -v|pnpm -v|which|type|file|wc)/.test(cmd)) {
            return 'approved';
          }
          return 'user-approval';
        },
        ssh_write_file: 'user-approval',
        build_project: 'user-approval',
        deploy_service: 'user-approval',
        git_commit: 'user-approval',
        ssh_read_file: 'approved',
        health_check: 'approved',
        get_available_skills: 'approved',
        use_skill: 'approved',
        read_skill_file: 'approved',
        diagnose_error: 'approved',
        web_scrape: 'approved',
        web_search: 'approved',
        preview_html: 'approved',
      },
      stopWhen: isStepCount(Math.max(maxSteps, 15)),
      prepareStep: async ({ messages, stepNumber }) => {
        const estimatedTokens = JSON.stringify(messages).length / 4;
        if (estimatedTokens > 100000) {
          logger.info(`[WS-AI] Context compression at step ${stepNumber}: ${Math.round(estimatedTokens)} tokens, pruning...`);
          return {
            messages: pruneMessages({
              messages,
              reasoning: 'all',
              toolCalls: 'before-last-3-messages',
              emptyMessages: 'remove',
            }),
          };
        }
        return {};
      },
      temperature,
      maxOutputTokens: wsMaxOutputTokens,
      ...(wsTopP !== undefined && { topP: wsTopP }),
      onToolExecutionStart: ({ toolCall }) => {
        logger.info(`[WS-AI] Tool executing: ${toolCall.toolName}`);
      },
      onToolExecutionEnd: ({ toolCall, toolOutput, toolExecutionMs }) => {
        const status = toolOutput.type === 'tool-error' ? 'ERROR' : 'OK';
        logger.info(`[WS-AI] Tool completed: ${toolCall.toolName} [${status}] ${toolExecutionMs}ms`);
      },
      telemetry: {
        isEnabled: true,
        functionId: 'workspace-chat-completion',
      },
    });

    // AI SDK v7: createUIMessageStream for follow-up stream merging
    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        const agentResult = await agent.stream({
          messages: userAssistantMessages as any,
          timeout: { totalMs: Math.max(300000, maxSteps * 30000), stepMs: 30000 },
          onStepEnd: ({ finishReason, toolCalls, text }) => {
            wsStepCount++;
            logger.info(`[WS-AI] Step ${wsStepCount}: finishReason=${finishReason}, toolCalls=${toolCalls?.length || 0}, textLen=${text?.length || 0}`);
          },
          abortSignal: wsCombinedSignal,
        });

        writer.merge(agentResult.toUIMessageStream({
          sendReasoning: true,
          messageMetadata: ({ part }: any) => {
            if (part.type === 'start' || part.type === 'finish') {
              return { conversationId: conversationId || projectId } as any;
            }
            return undefined;
          },
        }));

        const text = (await agentResult.text) || '';
        const isDSMLText = text && (text.includes('DSML') || text.includes('tool_calls') || text.includes('invoke name='));
        const effectiveText = isDSMLText ? '' : text;
        if (isDSMLText) {
          logger.info('[WS-AI] Detected DSML markup, treating as no-text:', text.slice(0, 200));
        }

        // Extract tool results from steps
        const allToolResults: string[] = [];
        const toolPartsForLog: {name: string; output: string}[] = [];
        for (const step of await agentResult.steps) {
          for (const tc of step.toolCalls || []) {
            const tr = step.toolResults?.find((r: any) => r.toolCallId === tc.toolCallId);
            if (tr) {
              const out = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
              allToolResults.push(`[${tc.toolName}] ${out.slice(0, 500)}`);
              toolPartsForLog.push({ name: tc.toolName, output: out });
            }
          }
        }
        const execLog = toolPartsForLog.length > 0 ? toolPartsForLog.map((tp, i) => {
          return `${i + 1}. ${tp.name}: ${tp.output.startsWith('\u274c') ? '\u274c' : '\u2705'} ${tp.output.slice(0, 100)}`;
        }).join('\n') : '';

        if (effectiveText && projectId) {
          let savedContent = effectiveText;
          if (toolPartsForLog.length > 0) {
            const reportTitle = effectiveText.match(/^#{1,6}\s+(.+)/m)?.[1]?.trim() || '\u5206\u6790\u62a5\u544a';
            savedContent = effectiveText + '\n\n<!--REPORT_CARD\n' + reportTitle + '\n-->\n<!--EXEC_LOG\n' + execLog + '\n-->';
          } else {
            savedContent = effectiveText + (execLog ? '\n\n<!--EXEC_LOG\n' + execLog + '\n-->' : '');
          }
          try {
            const { randomUUID } = await import('crypto');
            const msgId = randomUUID();
            await run(
              'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
              [msgId, projectId, 'assistant', savedContent, modelId]
            );
          } catch (e) {
            console.error('[WS-AI] Save assistant message error:', e);
          }
        } else if (!effectiveText && (toolPartsForLog.length > 0 || allToolResults.length > 0)) {
          logger.info('[WS-AI] No text after tools, starting follow-up stream merge...');
          const toolContext = allToolResults.length > 0
            ? '\n\n以下是之前工具调用的结果摘要：\n' + allToolResults.map((r, i) => `${i + 1}. ${r}`).join('\n')
            : '';

          const followUpResult = streamText({
            system: fullSystemPrompt + '\n\n【重要】你之前已经通过工具收集了足够的信息。现在你必须用中文写一篇完整的分析报告。\n\n输出要求：\n1. 用 Markdown 格式输出\n2. 使用 ## 二级标题划分章节\n3. 数据对比用 Markdown 表格\n4. 要点用加粗和列表突出显示\n5. 禁止输出任何DSML标签、工具调用代码或XML格式',
            model: wrappedModel,
            messages: [
              ...userAssistantMessages,
              { role: 'user' as const, content: '基于以上所有工具调用收集到的信息，请用 Markdown 格式输出中文分析报告。\n\n要求：\n- ## 二级标题划分章节\n- 数据对比用 Markdown 表格\n- 重点用 **加粗**\n- 条目用 - 列表\n\n注意：你现在没有工具可用，必须直接用纯文字输出。' + toolContext }
            ] as any,
            temperature,
            maxOutputTokens: wsMaxOutputTokens,
            maxRetries: 1,
            timeout: { totalMs: 60000, stepMs: 30000 },
            abortSignal: wsCombinedSignal,
          });

          writer.merge(followUpResult.toUIMessageStream({
            sendReasoning: true,
          }));

          const followUpText = await followUpResult.text;
          if (followUpText) {
            const reportTitle = followUpText.match(/^#{1,6}\s+(.+)/m)?.[1]?.trim() || '\u5206\u6790\u62a5\u544a';
            const fullContent = followUpText + '\n\n<!--REPORT_CARD\n' + reportTitle + '\n-->\n<!--EXEC_LOG\n' + execLog + '\n-->';
            try {
              const { randomUUID } = await import('crypto');
              const msgId = randomUUID();
              await run(
                'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
                [msgId, projectId, 'assistant', fullContent, modelId]
              );
              logger.info(`[WS-AI] Follow-up report generated: ${followUpText.length} chars`);
            } catch (e) {
              console.error('[WS-AI] Save follow-up error:', e);
            }
          } else {
            try {
              const { randomUUID } = await import('crypto');
              const msgId = randomUUID();
              await run(
                'INSERT INTO workspace_messages (id, "conversationId", role, content, "modelId", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
                [msgId, projectId, 'assistant', '\u26a0\ufe0f 工具调用已完成，但生成报告失败。请发送"总结"重试。', modelId]
              );
            } catch {}
          }
        }
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });

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

    
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || '服务器内部错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
