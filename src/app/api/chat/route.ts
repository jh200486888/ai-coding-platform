import { NextRequest } from 'next/server';
import { streamText, stepCountIs, wrapLanguageModel, extractReasoningMiddleware, LanguageModelMiddleware } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createConversation, createMessage, updateConversation, getApiKeyByProvider, getModelConfig, getSetting, setConversationUserId } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { tool } from 'ai';
import { createSubAgentTool } from '@/lib/sub-agents';

import { describeImages } from '@/lib/vision-proxy';
// ============ 日志中间件（AI SDK 原生 Middleware） ============
const loggingMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate, params, model }) => {
    const startTime = Date.now();
    console.log(`[AI] ${model?.modelId || 'unknown'} request started`);
    const result = await doGenerate();
    const duration = Date.now() - startTime;
    console.log(`[AI] ${model?.modelId || 'unknown'} completed in ${duration}ms`);
    return result;
  },
  wrapStream: async ({ doStream, params, model }) => {
    const startTime = Date.now();
    console.log(`[AI] ${model?.modelId || 'unknown'} stream started`);
    const result = await doStream();
    const duration = Date.now() - startTime;
    console.log(`[AI] ${model?.modelId || 'unknown'} stream completed in ${duration}ms`);
    return result;
  },
};

// ============ 工具执行函数 ============
const PROJECT_DIR = process.env.PROJECT_DIR || '/www/wwwroot/agent.piyiguo.com';

async function execCreateFile(path: string, content: string): Promise<string> {
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  await fs.mkdir(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return `✅ 文件已创建: ${path}`;
}

async function execEditFile(path: string, oldText: string, newText: string): Promise<string> {
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  const content = await fs.readFile(filePath, 'utf-8');
  const newContent = content.replace(oldText, newText);
  if (newContent === content) return '⚠️ 未找到匹配文本，文件未修改';
  await fs.writeFile(filePath, newContent, 'utf-8');
  return `✅ 文件已修改: ${path}`;
}

async function execDeleteFile(path: string): Promise<string> {
  const fs = await import('fs/promises');
  try {
    await fs.unlink(`${PROJECT_DIR}/${path}`);
    return `✅ 已删除: ${path}`;
  } catch (e: any) { return `❌ 删除失败: ${e.message || '文件不存在'}`; }
}

async function execReadFile(path: string): Promise<string> {
  const fs = await import('fs/promises');
  const filePath = `${PROJECT_DIR}/${path}`;
  const content = await fs.readFile(filePath, 'utf-8');
  return content.slice(0, 50000);
}

async function execRunCommand(command: string): Promise<string> {
  const { execSync } = await import('child_process');
  try {
    const result = execSync(command, {
      cwd: PROJECT_DIR,
      timeout: 120000,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.slice(0, 10000) || '✅ 命令执行成功（无输出）';
  } catch (e: any) {
    const out = e.stdout?.slice(0, 5000) || '';
    const err = e.stderr?.slice(0, 5000) || '';
    return `❌ 命令失败 (exit ${e.status}):\n${out}\n${err}`;
  }
}

async function execDeploy(): Promise<string> {
  const { execSync } = await import('child_process');
  const steps = ['pnpm install', 'pnpm build', 'pm2 restart ai-coding-platform'];
  const results: string[] = [];
  for (const step of steps) {
    try {
      const r = execSync(step, { cwd: PROJECT_DIR, timeout: 180000, encoding: 'utf-8', maxBuffer: 10*1024*1024 });
      results.push(`✅ ${step}: ${r.slice(0, 500)}`);
    } catch (e: any) {
      results.push(`❌ ${step}: ${e.message?.slice(0, 500)}`);
      break;
    }
  }
  return results.join('\n');
}

// ============ 联网搜索 ============
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
    // Bing搜索结果解析 - 匹配 h2 标签中的链接标题
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

// ============ 工具定义（AI SDK v7 格式） ============
const tools = {
  createFile: tool({
    description: '在项目目录创建文件。必须提供完整文件路径和文件内容。',
    inputSchema: z.object({
      path: z.string().describe('文件相对路径，如 src/app/page.tsx'),
      content: z.string().describe('文件完整内容'),
    }),
    execute: async ({ path, content }) => execCreateFile(path, content),
  }),
  editFile: tool({
    description: '修改已有文件。提供旧文本和新文本进行替换。',
    inputSchema: z.object({
      path: z.string().describe('文件相对路径'),
      oldText: z.string().describe('要替换的原始文本'),
      newText: z.string().describe('替换后的新文本'),
    }),
    execute: async ({ path, oldText, newText }) => execEditFile(path, oldText, newText),
  }),
  deleteFile: tool({
    description: '删除项目中的文件。',
    inputSchema: z.object({
      path: z.string().describe('文件相对路径'),
    }),
    execute: async ({ path }) => execDeleteFile(path),
  }),
  readFile: tool({
    description: '读取项目中的文件内容。',
    inputSchema: z.object({
      path: z.string().describe('文件相对路径'),
    }),
    execute: async ({ path }) => execReadFile(path),
  }),
  runCommand: tool({
    description: '在项目目录执行 shell 命令。用于安装依赖、构建、部署等。',
    inputSchema: z.object({
      command: z.string().describe('要执行的命令，如 pnpm install, pnpm build, pm2 restart'),
    }),
    execute: async ({ command }) => execRunCommand(command),
  }),
  deploy: tool({
    description: '部署项目：执行 pnpm install + pnpm build + pm2 restart。',
    inputSchema: z.object({
      confirm: z.boolean().describe('确认部署'),
    }),
    execute: async () => execDeploy(),
  }),
  searchWeb: tool({
    description: "搜索互联网获取实时信息。用于查询最新新闻、价格、技术文档等。",
    inputSchema: z.object({
      query: z.string().describe("搜索关键词"),
    }),
    execute: async ({ query }) => execSearchWeb(query),
  }),
  saveMemory: tool({
    description: '保存记忆到长期存储。当用户说记住或提到重要偏好、项目信息时使用。',
    inputSchema: z.object({
      category: z.string().describe("分类：preference/project/fact/note"),
      content: z.string().describe("要记住的内容"),
    }),
    execute: async ({ category, content }) => execSaveMemory(category, content),
  }),
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

// ============ Provider URL 映射（从 models.ts 统一导入） ============
import { PROVIDER_URLS } from '@/lib/models';

// ============ 系统提示词 ============
const SYSTEM_PROMPT = `你是一个专业的AI编程助手，运行在服务器上，可以直接操作文件和执行命令。

【绝对规则】
1. 创建文件时必须用 createFile 工具，不要在对话中粘贴长代码让用户自己复制
2. 禁止说明部署步骤！必须用 deploy 工具部署
3. 禁止使用"我来帮你"、"让我看看"等引导性语言
4. 禁止使用 ** 加粗或 Markdown 格式化
5. 禁止说"我无法访问/执行"——你已经在服务器上
6. 禁止说"无法访问外部链接"——用 runCommand 执行 curl

【工作流】
收到需求 → 思考方案 → 调用工具执行 → 确认结果 → 简洁回复

你是真实运行在服务器上的，不是在模拟。直接行动，不要犹豫。
- 完成后用1-2句话总结做了什么、结果如何。`;

// ============ 模式系统提示词 ============
const MODE_PROMPTS: Record<string, string> = {
  coding: SYSTEM_PROMPT,
  writing: `你是一个专业文案写作助手，擅长各类文案创作。

【能力】
- 广告文案、品牌slogan、产品描述
- 公众号文章、小红书文案、短视频脚本
- 商务邮件、公文、报告
- 翻译（中英日韩）、改写润色、起标题

【规则】
- 直接给出内容，不要说"我来帮你写"
- 不要使用 Markdown 格式化（不加粗、不标题号）
- 根据场景调整语气：活泼/正式/专业/幽默
- 如果用户没指定风格，给出2-3个版本供选择
- 完成后用1-2句话总结你做了什么`,

  analysis: `你是一个数据分析与策略顾问，擅长深度分析和结构化思考。

【能力】
- 数据分析、趋势解读、竞品对比
- 商业策略、市场洞察、可行性评估
- 问题诊断、方案设计、决策支持
- 报告撰写、要点提炼、逻辑梳理

【规则】
- 结构清晰，先给结论再展开
- 不要使用 Markdown 格式化
- 有数据支撑时注明来源或标注"估算"
- 不确定的内容明确说明，不要编造
- 完成后用1-2句话总结核心结论`,

  design: `你是一个UI/UX设计顾问，擅长界面设计和视觉方案。

【能力】
- 页面布局方案、组件设计建议
- 配色方案、字体搭配、间距规范
- 交互流程、用户体验优化
- 设计系统搭建、组件库规划

【规则】
- 描述要具体可执行，给出数值（如间距16px、圆角8px）
- 不要使用 Markdown 格式化
- 可以推荐参考设计趋势或竞品
- 理解用户需求后给出完整方案，不要一步步追问
- 完成后用1-2句话总结方案要点`,

  chat: `你是一个智能助手，可以聊天、问答、头脑风暴、知识科普。

【规则】
- 回答简洁自然，像朋友聊天
- 不要使用 Markdown 格式化
- 有问有答，主动但不啰嗦
- 不确定的说"我不太确定"，不要编造
- 长回答最后用1句话总结要点`,
};

const MODE_TOOLS: Record<string, string[]> = {
  coding: ['createFile', 'editFile', 'deleteFile', 'readFile', 'runCommand', 'deploy', 'searchWeb', 'saveMemory', 'delegate_task'],
  writing: ['searchWeb', 'saveMemory', 'delegate_task'],
  analysis: ['searchWeb', 'saveMemory', 'delegate_task'],
  design: ['saveMemory'],
  chat: ['searchWeb', 'saveMemory', 'delegate_task'],
};

const TOOL_NAME_ZH_CHAT: Record<string, string> = {
  createFile: '创建文件',
  editFile: '修改文件',
  deleteFile: '删除文件',
  readFile: '读取文件',
  runCommand: '执行命令',
  deploy: '部署项目',
  searchWeb: '联网搜索',
  saveMemory: '保存记忆',
  run_evaluation: '评估质量',
  run_optimization: '优化代码',
  run_code_review: '代码审查',
  run_refactor: '重构代码',
  delegate_task: '委派子智能体',
  generate_image: '生成图片',
  saveMemory_enhanced: '保存记忆',
  searchMemory: '搜索记忆',
  updateMemory: '更新记忆',
  deleteMemory: '删除记忆',
  listMemories: '列出记忆',
};

// 模型身份映射
const MODEL_IDENTITY: Record<string, string> = {
  deepseek: 'DeepSeek 深度求索',
  zhipu: '智谱AI (GLM)',
  qwen: '通义千问 (Qwen)',
  openai: 'OpenAI (GPT)',
  'openai-image': 'OpenAI (GPT Image)',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  moonshot: 'Kimi 月之暗面',
  doubao: '豆包 (Doubao)',
  groq: 'Groq (Llama)',
  banana: 'Banana',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, model_id: rawModelId, modelId: rawModelId2, mode: rawMode, enable_search, attachments: bodyAttachments, messages: rawMessages } = body as {
      conversation_id?: string;
      model_id?: string;
      modelId?: string;
      mode?: string;
      enable_search?: boolean;
      attachments?: any[];
      messages: any[];
    };
    const mode = rawMode || 'coding';

    // Normalize UIMessage format (from useChat) to { role, content } format
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
    let model_id = rawModelId || rawModelId2 || '';

    // Detect if user sent image attachments (from body or message markers)
    const hasImageAttachments = (bodyAttachments && bodyAttachments.some((a: any) => a.type === 'image')) ||
      messages.some((m: any) => {
        const c = typeof m.content === 'string' ? m.content : '';
        return c.includes('[image:');
      });
    // Multimodal model candidates (preferred order)
    const MULTIMODAL_MODEL_ORDER = ['gpt-4o', 'gpt-4.1', 'gemini-2.5-pro', 'gemini-2.5-flash', 'qwen-max', 'qwen-plus', 'claude-sonnet-4-5', 'glm-4.5-flash', 'glm-5.2'];

    // Auto model selection: pick first available model with active API key
    if (model_id === 'auto') {
      const preferredOrder = ['deepseek-v4-flash', 'gpt-4.1', 'claude-sonnet-4-5', 'qwen-max', 'glm-4.5-flash'];
      for (const candidate of preferredOrder) {
        const cfg = await getModelConfig(candidate);
        if (cfg) {
          const keyData = await getApiKeyByProvider(cfg.provider);
          if (keyData && keyData.is_active) {
            model_id = candidate;
            break;
          }
        }
      }
      if (model_id === 'auto') { const dm = await getSetting('default_model'); model_id = dm || 'deepseek-v4-flash'; }
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取模型和 API Key 配置
    let modelConfig = await getModelConfig(model_id);
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `模型 ${model_id} 未配置` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Auto-switch to multimodal model if user sent images but current model doesn't support it
    if (hasImageAttachments) {
      const MULTIMODAL_PROVIDERS = ['openai', 'anthropic', 'google', 'qwen', 'zhipu'];
      const isMultimodal = MULTIMODAL_PROVIDERS.includes(modelConfig.provider) || 
        MULTIMODAL_MODEL_ORDER.some(m => model_id.includes(m));
      
      if (!isMultimodal) {
        // Try to find an available multimodal model
        for (const candidate of MULTIMODAL_MODEL_ORDER) {
          const cfg = await getModelConfig(candidate);
          if (cfg) {
            const keyData = await getApiKeyByProvider(cfg.provider);
            if (keyData && keyData.is_active) {
              console.log(`[Multimodal] Auto-switching from ${model_id} to ${candidate} for image input`);
              model_id = candidate;
              modelConfig = cfg;
              break;
            }
          }
        }
      }
    }

    const apiKeyData = await getApiKeyByProvider(modelConfig.provider);
    if (!apiKeyData || !apiKeyData.is_active) {
      return new Response(JSON.stringify({ error: `请先在后台配置 ${modelConfig.provider} 的 API Key` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Buffer.from(apiKeyData.api_key_encrypted, 'base64').toString('utf-8');
    const baseUrl = apiKeyData.base_url || PROVIDER_URLS[modelConfig.provider] || `https://api.${modelConfig.provider}.com/v1`;

    // 创建对话
    let convId = conversation_id;
    if (!convId) {
      const userMsg = messages.find(m => m.role === 'user');
      const userText = userMsg ? ((userMsg as any).content || ((userMsg as any).parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')) : '';
      const title = userText ? userText.slice(0, 50) + (userText.length > 50 ? '...' : '') : 'New Chat';
      const conv = await createConversation(title, model_id);
      convId = conv.id;
      // Associate conversation with logged-in user
      const currentUser = await getCurrentUser();
      if (currentUser) await setConversationUserId(convId, currentUser.id);
    } else {
      await updateConversation(convId, { model_id });
    }

    // 保存用户消息（兼容 useChat UIMessage 的 parts 格式）
    const userMessage = messages[messages.length - 1] as any;
    if (userMessage && userMessage.role === 'user') {
      const userContent = userMessage.content ||
        (userMessage.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      if (userContent) await createMessage(convId, 'user', userContent, model_id);
    }

    // ====== 从 settings 读取可配置参数 ======
    let maxSteps = 5;
    let temperature: number | undefined = undefined;

    try {
      const advStr = await getSetting('advanced_config');
      if (advStr) {
        const adv = JSON.parse(advStr);
        if (adv.max_steps !== undefined) maxSteps = adv.max_steps;
      }
    } catch {}

    try {
      const tempStr = await getSetting('mode_temperatures');
      if (tempStr) {
        const temps = JSON.parse(tempStr);
        if (temps[mode] !== undefined) temperature = temps[mode];
      }
    } catch {}

    // 如果没从 settings 获取到温度，使用默认值
    if (temperature === undefined) {
      const defaultTemps: Record<string, number> = { coding: 0, writing: 0.7, analysis: 0.1, design: 0.3, chat: 0.5 };
      temperature = defaultTemps[mode] ?? 0.3;
    }

    // ====== 读取超时、重试和模型生成参数 ======
    let timeoutTotalMs = 120000;  // 默认 2 分钟总超时
    let timeoutStepMs = 30000;    // 默认 30 秒单步超时
    let maxRetries = 3;
    let topP: number | undefined = undefined;
    let presencePenalty: number | undefined = undefined;
    let frequencyPenalty: number | undefined = undefined;
    let seed: number | undefined = undefined;
    let maxOutputTokens = 16384;

    try {
      const advStr2 = await getSetting('advanced_config');
      if (advStr2) {
        const adv2 = JSON.parse(advStr2);
        if (adv2.tool_timeout !== undefined) timeoutTotalMs = adv2.tool_timeout * 1000;
        if (adv2.timeout_step !== undefined) timeoutStepMs = adv2.timeout_step * 1000;
        if (adv2.max_retries !== undefined) maxRetries = adv2.max_retries;
        if (adv2.topP !== undefined && adv2.topP !== 0.9) topP = adv2.topP;
        if (adv2.presencePenalty !== undefined && adv2.presencePenalty !== 0) presencePenalty = adv2.presencePenalty;
        if (adv2.frequencyPenalty !== undefined && adv2.frequencyPenalty !== 0) frequencyPenalty = adv2.frequencyPenalty;
        if (adv2.seed !== undefined && adv2.seed !== -1) seed = adv2.seed;
        if (adv2.max_output_tokens !== undefined) maxOutputTokens = adv2.max_output_tokens;
      }
    } catch {}

    // 构建 AI SDK provider
    const provider = createOpenAICompatible({
      name: modelConfig.provider,
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const model = provider.languageModel(model_id);

    // Check if model supports multimodal (image input)
    const MULTIMODAL_PROVIDERS = ['openai', 'anthropic', 'google', 'qwen', 'zhipu'];
    const supportsMultimodal = MULTIMODAL_PROVIDERS.includes(modelConfig.provider) || 
      MULTIMODAL_MODEL_ORDER.some(m => model_id.includes(m));

    // 构建系统提示词
    const identityName = MODEL_IDENTITY[modelConfig.provider] || modelConfig.provider;
    const modePrompt = MODE_PROMPTS[mode] || SYSTEM_PROMPT;
    const memories = await getMemories();
    const memorySection = memories ? '\n\n【用户记忆】\n' + memories + '\n\n当用户提到与记忆相关的内容时，参考这些信息。用户说"记住"时，用 saveMemory 工具保存。' : '';
    const dynamicPrompt = modePrompt + memorySection + `\n\n【身份】你是 ${identityName} 的 ${model_id} 模型。当用户问你是谁时，如实回答。`;

    // Filter out system messages (AI SDK v7 requires system via system option only)
    const userAssistantMessages = messages.filter((m: any) => {
      const role = String(m.role || "").toLowerCase().trim();
      return role !== "system" && role !== "developer" && role !== "tool";
    }).map((m: any) => ({
      ...m,
      role: String(m.role || "").toLowerCase().trim() === "assistant" ? "assistant" : "user",
    }));

    // Build messages with multi-modal support (images, PDFs, files, body attachments)
    const chatMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; data?: string; mediaType?: string; image_url?: { url: string }; image?: any }> }>= [];
      // Process messages with async support for vision proxy
      for (let msgIdx = 0; msgIdx < userAssistantMessages.length; msgIdx++) {
        const m = userAssistantMessages[msgIdx];
        const idx = msgIdx;
        // Match image markers: [image:data:image/png;base64,...]
        const imageMatches = [...m.content.matchAll(/\[image:([\s\S]*?)\]/g)];
        // Match file content markers: [file:filename]:\ncontent
        const fileContentMatches = [...m.content.matchAll(/\[file:([^\]]*?)\]:\n([\s\S]*?)(?=\n\[|$)/g)];
        // Match file URL markers: [file:data:...]
        const fileUrlMatches = [...m.content.matchAll(/\[file:(data:[^\]]+)\]/g)];
        
        const hasAttachments = imageMatches.length > 0 || fileContentMatches.length > 0 || fileUrlMatches.length > 0;
        const isLastUserMsg = m.role === 'user' && idx === userAssistantMessages.length - 1;
        const hasBodyAttachments = isLastUserMsg && bodyAttachments && bodyAttachments.length > 0;
        
        if (m.role === 'user' && (hasAttachments || hasBodyAttachments)) {
          const parts: Array<{ type: string; text?: string; data?: string; mediaType?: string; image_url?: { url: string }; image?: any }> = [];
          // Clean text: remove all attachment markers
          let textContent = m.content
            .replace(/\[image:[\s\S]*?\]/g, '')
            .replace(/\[file:[^\]]*?\]:[\s\S]*?(?=\n\[|$)/g, '')
            .replace(/\[file:data:[^\]]+\]/g, '')
            .trim();
          
          if (textContent) {
            parts.push({ type: 'text', text: textContent });
          }
          
          // Add image parts
          const collectedImages: Array<{ base64Data: string; mediaType: string }> = [];
          for (const imgMatch of imageMatches) {
            const imgUrl = imgMatch[1].trim();
            if (imgUrl.startsWith('data:image/') || imgUrl.startsWith('data:')) {
              const mediaTypeMatch = imgUrl.match(/data:(image\/[^;]+);/);
              const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/png';
              const base64Data = imgUrl.split(',')[1] || '';
              if (supportsMultimodal) {
                // Multimodal model: send image directly
                parts.push({ type: 'file', data: base64Data, mediaType });
              } else {
                // Non-multimodal model: collect for vision proxy
                collectedImages.push({ base64Data, mediaType });
              }
            }
          }
          
          // Add file content parts
          for (const fcMatch of fileContentMatches) {
            const fileName = fcMatch[1].trim();
            const fileContent = fcMatch[2].trim();
            if (fileContent) {
              parts.push({ type: 'text', text: `[文件: ${fileName}]\n${fileContent.slice(0, 6000)}` });
            }
          }
          
          // Add body attachments (for the last user message)
          if (hasBodyAttachments) {
            for (const att of bodyAttachments!) {
              if (att.type === 'image' && att.url) {
                const imgUrl = att.url;
                const mediaTypeMatch = imgUrl.match(/data:(image\/[^;]+);/);
                const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/png';
                const base64Data = imgUrl.split(',')[1] || '';
                if (supportsMultimodal) {
                  parts.push({ type: 'file', data: base64Data, mediaType });
                } else {
                  // Non-multimodal model: collect for vision proxy
                  collectedImages.push({ base64Data, mediaType });
                }
              } else if (att.content) {
                parts.push({ type: 'text', text: `[文件: ${att.name}]\n${att.content.slice(0, 6000)}` });
              }
            }
          }
          
          // Vision proxy: if non-multimodal model and images collected, describe them via vision model
          if (!supportsMultimodal && collectedImages.length > 0) {
            try {
              const imageDescription = await describeImages(collectedImages, textContent || undefined);
              parts.push({ type: 'text', text: imageDescription });
            } catch (e: any) {
              parts.push({ type: 'text', text: '[图片识别失败: ' + (e.message || '未知错误') + ']' });
            }
          }
          
          chatMessages.push({ role: m.role, content: parts.length > 0 ? parts : m.content });
        } else {
          chatMessages.push({ role: m.role, content: m.content });
        }
      }

    // 合并工具：基础工具 + 增强工具 + MCP工具
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

    // 子智能体工具（AI SDK 原生 ToolLoopAgent）- 委派任务给专门的子智能体
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
      system: dynamicPrompt,
      model: wrappedModel,
      messages: chatMessages as any,
      tools: Object.keys(activeTools).length > 0 ? activeTools : undefined,
      stopWhen: stepCountIs(maxSteps),
      temperature,
      maxOutputTokens,
      maxRetries,
      timeout: { totalMs: timeoutTotalMs, stepMs: timeoutStepMs },
      ...(topP !== undefined && { topP }),
      ...(presencePenalty !== undefined && { presencePenalty }),
      ...(frequencyPenalty !== undefined && { frequencyPenalty }),
      ...(seed !== undefined && { seed }),
      telemetry: {
        isEnabled: true,
        functionId: 'chat-completion',
      },
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      // 通过 messageMetadata 将 conversation_id 传给前端
      messageMetadata: ({ part }) => {
        if (part.type === 'start' || part.type === 'finish') {
          return { conversationId: convId } as any;
        }
        return undefined;
      },
      // 流结束后保存助手消息 + 遥测
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
          if (text && !isAborted) await createMessage(convId!, 'assistant', savedContent, model_id);
        } catch {}

        try {
          const { telemetry } = await import('@/lib/ai-telemetry');
          telemetry.recordAICall({
            provider: modelConfig.provider, model: model_id,
            operation: 'chat_stream', durationMs: Date.now() - streamStartTime, success: true,
          });
        } catch {}

        // 记录到 telemetry_events 表（AI SDK 原生 Telemetry 补充）
        try {
          const { recordTelemetry } = await import('@/lib/telemetry');
          await recordTelemetry({
            functionId: 'chat-completion',
            model: model_id,
            mode: mode,
            durationMs: Date.now() - streamStartTime,
            status: 'success',
          });
        } catch {}

        try { const { mcpManager } = await import('@/lib/mcp-client'); await mcpManager.closeAll(); } catch {}
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

