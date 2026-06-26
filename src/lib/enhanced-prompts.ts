import { getSetting } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

const MODEL_IDENTITY: Record<string, string> = {
  deepseek: 'DeepSeek 深度求索', zhipu: '智谱AI (GLM)', qwen: '通义千问 (Qwen)', openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)', google: 'Google (Gemini)', moonshot: 'Kimi 月之暗面', doubao: '豆包',
  groq: 'Groq (Llama)', mistral: 'Mistral', cohere: 'Cohere', meta: 'Meta (Llama)',
  banana: 'Banana', spark: '讯飞星火', yi: '零一万物', baidu: '文心一言', minimax: 'MiniMax',
};

const BASE_MODE_PROMPTS: Record<string, string> = {
  coding: '__SYSTEM_PROMPT__',
  writing: '你是一个专业文案写作助手。\n【规则】直接给内容，不用Markdown。根据场景调整语气。没指定风格给2-3个版本。完成后1-2句总结。',
  analysis: '你是数据分析与策略顾问。\n【规则】先结论后展开。不用Markdown。注明来源。不确定就说明。完成后总结核心结论。',
  design: '你是UI/UX设计顾问。\n【规则】给具体数值。不用Markdown。给完整方案不逐步追问。完成后总结要点。',
  chat: '你是智能助手。\n【规则】简洁自然。不用Markdown。不编造。长回答最后1句总结。',
};

export async function buildEnhancedSystemPrompt(mode: string, provider: string, modelId: string, memoryContext?: string): Promise<string> {
  let base: string;
  try {
    const dp = await getSetting('system_prompt');
    base = dp?.trim() || readFileSync(join(process.cwd(), 'system-prompt.md'), 'utf-8').trim();
  } catch { base = '你是AI编程搭档，能直接操作服务器。收到任务后立即执行，做完总结结果。'; }
  const MP: Record<string,string> = { ...BASE_MODE_PROMPTS, coding: base };
  let p = (MP[mode]||base) + `\n\n【身份】你是 ${MODEL_IDENTITY[provider]||provider} 的 ${modelId} 模型。`;
  if (memoryContext) p += memoryContext;
  p += `\n\n【工具指南】工具调用保持精确。先readFile再修改。复杂任务分步执行。可用子智能体工具处理研究任务。用saveMemory保存重要信息。`;
  return p;
}

export function suggestTemperature(mode: string, hasTools: boolean): number {
  if (hasTools && mode === 'coding') return 0;
  if (mode === 'analysis') return 0.1;
  if (mode === 'writing') return 0.7;
  if (mode === 'chat') return 0.5;
  return 0.3;
}

export { MODEL_IDENTITY, BASE_MODE_PROMPTS };
