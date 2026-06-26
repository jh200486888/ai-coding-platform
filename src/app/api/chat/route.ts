import { NextRequest } from 'next/server';
import { streamText, stepCountIs } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createConversation, createMessage, updateConversation, getApiKeyByProvider, getModelConfig, getSetting } from '@/lib/db';
import { z } from 'zod';
import { tool } from 'ai';

// ============ 工具执行函数 ============
const PROJECT_DIR = '/www/wwwroot/agent.piyiguo.com';

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
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&count=5';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    const html = await res.text();
    const results: string[] = [];
    const matches = html.matchAll(/<li class="b_algo">([\s\S]*?)<\/li>/g);
    let count = 0;
    for (const m of matches) {
      if (count >= 5) break;
      const block = m[1];
      const titleMatch = block.match(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      if (title) {
        count++;
        results.push(count + '. ' + title + (snippet ? ' - ' + snippet : ''));
      }
    }
    if (results.length === 0) return '未找到搜索结果，请尝试换个关键词';
    return '搜索结果（' + query + '）：\n' + results.join('\n');
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

// ============ Provider URL 映射 ============
const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  'openai-image': 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  kimi: 'https://api.moonshot.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  yi: 'https://api.lingyiwanwu.com/v1',
  baidu: 'https://qianfan.baidubce.com/v2',
  spark: 'https://spark-api-open.xf-yun.com/v1',
  minimax: 'https://api.minimax.chat/v1',
  meta: 'https://api.together.xyz/v1',
  mistral: 'https://api.mistral.ai/v1',
  cohere: 'https://api.cohere.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  banana: 'https://api.banana.dev/v1',
};

// ============ 系统提示词 ============
const SYSTEM_PROMPT = `你是一个专业的AI编程助手，运行在服务器上，可以直接操作文件和执行命令。

【绝对规则】
1. 禁止展示代码！必须用 createFile 工具创建文件
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
  coding: ['createFile', 'editFile', 'deleteFile', 'readFile', 'runCommand', 'deploy', 'searchWeb', 'saveMemory'],
  writing: ['searchWeb', 'saveMemory'],
  analysis: ['searchWeb', 'saveMemory'],
  design: ['saveMemory'],
  chat: ['searchWeb', 'saveMemory'],
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
    const { conversation_id, model_id: rawModelId, modelId: rawModelId2, mode: rawMode, messages } = body as {
      conversation_id?: string;
      model_id?: string;
      modelId?: string;
      mode?: string;
      messages: { role: string; content: string }[];
    };
    const mode = rawMode || 'coding';
    const model_id = rawModelId || rawModelId2 || 'deepseek-v4-flash';

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取模型和 API Key 配置
    const modelConfig = await getModelConfig(model_id);
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `模型 ${model_id} 未配置` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
      const title = userMsg ? userMsg.content.slice(0, 50) + (userMsg.content.length > 50 ? '...' : '') : 'New Chat';
      const conv = await createConversation(title, model_id);
      convId = conv.id;
    } else {
      await updateConversation(convId, { model_id });
    }

    // 保存用户消息
    const userMessage = messages[messages.length - 1];
    if (userMessage && userMessage.role === 'user') {
      await createMessage(convId, 'user', userMessage.content, model_id);
    }

    // ====== 从 settings 读取可配置参数 ======
    let maxSteps = 15;
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

    // 构建 AI SDK provider
    const provider = createOpenAICompatible({
      name: modelConfig.provider,
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const model = provider.languageModel(model_id);

    // 构建系统提示词
    const identityName = MODEL_IDENTITY[modelConfig.provider] || modelConfig.provider;
    const modePrompt = MODE_PROMPTS[mode] || SYSTEM_PROMPT;
    const memories = await getMemories();
    const memorySection = memories ? '\n\n【用户记忆】\n' + memories + '\n\n当用户提到与记忆相关的内容时，参考这些信息。用户说"记住"时，用 saveMemory 工具保存。' : '';
    const dynamicPrompt = modePrompt + memorySection + `\n\n【身份】你是 ${identityName} 的 ${model_id} 模型。当用户问你是谁时，如实回答。`;

    // Build messages with image support for vision models
    const chatMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: 'system', content: dynamicPrompt },
      ...messages.map(m => {
        const imageMatch = m.content.match(/\[image:(data:[^\]]+)\]/);
        if (imageMatch && m.role === 'user') {
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content.replace(/\[image:data:[^\]]+\]/g, '').trim() },
              { type: 'image_url', image_url: { url: imageMatch[1] } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    // 合并工具：基础工具 + 增强工具 + MCP工具
    const baseToolNames = MODE_TOOLS[mode] || [];
    const activeTools: Record<string, any> = {};
    for (const name of baseToolNames) {
      if (tools[name as keyof typeof tools]) activeTools[name] = tools[name as keyof typeof tools];
    }
    // 添加增强工具
    Object.assign(activeTools, enhancedTools);
    // 添加 MCP 工具
    Object.assign(activeTools, mcpToolsMap);

    const streamStartTime = Date.now();

    // 使用 AI SDK streamText
    const result = streamText({
      model,
      messages: chatMessages as any,
      tools: Object.keys(activeTools).length > 0 ? activeTools : undefined,
      stopWhen: stepCountIs(maxSteps),
      temperature,
      maxOutputTokens: 16384,
    });

    // 构建流式响应
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
          const toolCallRecords: any[] = [];

          for await (const event of result.fullStream) {
            switch (event.type) {
              case 'text-delta': {
                const text = (event as any).text || '';
                if (text) {
                  fullContent += text;
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text, conversation_id: convId })}\n\n`));
                }
                break;
              }
              case 'tool-call': {
                const toolName = (event as any).toolName || 'unknown';
                const callId = (event as any).toolCallId || '';
                const args = (event as any).input || {};
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool-start', toolName: TOOL_NAME_ZH_CHAT[toolName] || toolName, callId, args })}\n\n`));
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

          // 保存助手消息
          if (fullContent) {
            try {
              let savedContent = fullContent;
              if (toolCallRecords.length > 0) {
                const execLog = toolCallRecords.map((tc, i) => `${i + 1}. ${tc.name}: ${tc.status === 'done' ? '✅' : '❌'} ${tc.summary}`).join('\n');
                savedContent = fullContent + '\n\n<!--EXEC_LOG\n' + execLog + '\n-->';
              }
              await createMessage(convId!, 'assistant', savedContent, model_id);
            } catch {}
          }

          // 遥测记录
          try {
            const { telemetry } = await import('@/lib/ai-telemetry');
            const usage = await result.usage;
            telemetry.recordAICall({
              provider: modelConfig.provider,
              model: model_id,
              operation: 'chat_stream',
              durationMs: Date.now() - streamStartTime,
              tokensUsed: usage ? { prompt: usage.inputTokens || 0, completion: usage.outputTokens || 0, total: usage.totalTokens || 0 } : undefined,
              success: true,
            });
          } catch {}

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: convId })}\n\n`));
          safeClose();
          try { const { mcpManager } = await import('@/lib/mcp-client'); await mcpManager.closeAll(); } catch {}
        } catch (error: any) {
          try {
            const { telemetry } = await import('@/lib/ai-telemetry');
            telemetry.recordAICall({
              provider: modelConfig.provider,
              model: model_id,
              operation: 'chat_stream',
              durationMs: Date.now() - streamStartTime,
              success: false,
              errorCode: 'STREAM_ERROR',
              errorMessage: error.message || 'Stream error',
            });
          } catch {}
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Stream error' })}\n\n`));
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
