import { getSetting } from '@/lib/db';

const MODE_PROMPTS: Record<string, string> = {
  coding: '你是一个专业的编程助手...',
  writing: '你是一个专业的写作助手...',
  analysis: '你是一个专业的数据分析师...',
  design: '你是一个专业的UI/UX设计师...',
  chat: '你是一个友好的对话助手...',
};

const DEFAULT_TEMPS: Record<string, number> = {
  coding: 0, writing: 0.7, analysis: 0.1, design: 0.3, chat: 0.5,
};

export function detectMode(message: string): string {
  const lower = message.toLowerCase();
  if (/代码|函数|bug|error|报错|程序|编程|debug|开发|api|数据库/.test(lower)) return 'coding';
  if (/写|文章|文案|总结|翻译|润色|邮件|报告/.test(lower)) return 'writing';
  if (/分析|数据|统计|趋势|对比|图表/.test(lower)) return 'analysis';
  if (/设计|界面|ui|ux|配色|布局|样式/.test(lower)) return 'design';
  return 'chat';
}

export async function suggestTemperature(mode?: string): Promise<number> {
  try {
    const str = await getSetting('mode_temperatures');
    if (str) {
      const temps = JSON.parse(str);
      if (mode && temps[mode] !== undefined) return temps[mode];
    }
  } catch {}
  return mode ? (DEFAULT_TEMPS[mode] ?? 0.7) : 0.7;
}

export async function getSystemPrompt(): Promise<string> {
  try {
    const custom = await getSetting('system_prompt');
    if (custom) return custom;
  } catch {}
  return '你是一个智能编程助手...';
}

export async function buildEnhancedSystemPrompt(memoryContext?: string): Promise<string> {
  let prompt = await getSystemPrompt();
  if (memoryContext) prompt += `\n\n## 相关记忆\n${memoryContext}`;
  return prompt;
}

export async function getModePrompt(mode: string): Promise<string> {
  try {
    const str = await getSetting('mode_prompts');
    if (str) {
      const prompts = JSON.parse(str);
      if (prompts[mode]) return prompts[mode];
    }
  } catch {}
  return MODE_PROMPTS[mode] || '';
}
