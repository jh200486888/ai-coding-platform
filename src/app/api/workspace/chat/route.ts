import { NextRequest } from 'next/server';
import { streamText, isStepCount } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createConversation, createMessage, updateConversation, getApiKeyByProvider, getModelConfig } from '@/lib/db';
import { z } from 'zod';
import { tool } from 'ai';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

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

async function execDeploy(): Promise<string> {
  const steps = ['pnpm install', 'pnpm build', 'pm2 restart ai-coding-platform'];
  const results: string[] = [];
  for (const step of steps) {
    try {
      const { stdout, stderr } = await execAsync(step, {
        cwd: PROJECT_DIR,
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = (stdout || '') + (stderr ? '\n[stderr] ' + stderr : '');
      results.push(`✅ ${step}: ${output.slice(0, 500)}`);
    } catch (e: any) {
      const errMsg = e.stderr?.slice(0, 500) || e.stdout?.slice(0, 500) || e.message || '未知错误';
      results.push(`❌ ${step}: ${errMsg}`);
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

// ============ 工具定义（AI SDK v6 格式） ============
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
收到需求 → 一次性完成所有步骤 → 最后简洁总结
- 收到任务后立即开始执行，不要停下来等用户确认
- 需要读取文件时，读完直接继续下一步操作
- 多个工具调用在一轮内全部完成
- 所有步骤完成后，用1-2句话总结结果
- 遇到错误时，尝试自己解决（如修改文件内容重试），而不是停下来问用户
- 工具调用失败最多重试2次，仍失败则报告错误

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
  coding: ['createFile', 'editFile', 'readFile', 'runCommand', 'deploy', 'searchWeb', 'saveMemory'],
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
};




// 模型身份映射，防止模型自报家门时说错
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

    // 构建 AI SDK provider
    const provider = createOpenAICompatible({
      name: modelConfig.provider,
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const model = provider.languageModel(model_id);

    // 构建消息
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

    // 使用 AI SDK streamText
    const result = streamText({
      model,
      messages: chatMessages as any,
      tools: MODE_TOOLS[mode]?.length ? tools : undefined,
      stopWhen: isStepCount(8),
      allowSystemInMessages: true,
      temperature: 0.3,
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
          const toolCallRecords: Array<{ name: string; status: string; summary: string }> = [];

          for await (const event of result.stream) {
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

          // 保存助手消息 with tool execution log
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

          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: convId })}\n\n`));
          safeClose();
        } catch (error: any) {
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
