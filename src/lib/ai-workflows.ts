import { generateText, generateObject, tool } from 'ai';
import { z } from 'zod';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';

async function getLightModel() {
  const models = ['deepseek-v4-flash', 'glm-5-turbo'];
  for (const mid of models) {
    const cfg = await getModelConfig(mid);
    if (!cfg) continue;
    const kd = await getApiKeyByProvider(cfg.provider);
    if (kd?.api_key_encrypted && kd.is_active) {
      const key = Buffer.from(kd.api_key_encrypted, 'base64').toString('utf-8');
      const url = kd.base_url || `https://api.${cfg.provider}.com/v1`;
      return createOpenAICompatible({ name: cfg.provider, baseURL: url, headers: { Authorization: `Bearer ${key}` } }).languageModel(mid);
    }
  }
  return null;
}

export interface EvalResult {
  qualityScore: number; strengths: string[]; issues: string[]; suggestions: string[]; passed: boolean;
}

const evalSchema = z.object({
  qualityScore: z.number().min(1).max(10),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  passed: z.boolean(),
});

export async function evaluateContent(content: string, model: any, criteria: string): Promise<EvalResult> {
  try {
    const result = await generateObject({
      model,
      schema: evalSchema,
      system: '你是严格的质量评审专家。',
      prompt: `评估以下内容（标准：${criteria}）：\n\n${content.slice(0,4000)}`,
      temperature: 0,
    });
    return result.object as EvalResult;
  } catch {
    try {
      const { text } = await generateText({ model, system: '评审专家。给1-10分。', prompt: `评估（${criteria}）：\n${content.slice(0,3000)}\n\n格式：分数/10\n问题：...\n建议：...`, temperature: 0, maxOutputTokens: 800 });
      const m = text.match(/(\d+)\s*\/?\s*10/);
      const s = m ? parseInt(m[1]) : 5;
      return { qualityScore: s, strengths: ['已生成'], issues: s<7?['需改进']:[] , suggestions: ['建议复核'], passed: s>=7 };
    } catch {
      return { qualityScore: 5, strengths: ['已生成'], issues: ['无法评审'], suggestions: ['建议人工复核'], passed: false };
    }
  }
}

export async function reviewCodeWithWorkflow(code: string, model: any, lang: string = 'TypeScript', focus?: string) {
  const ev = await evaluateContent(code, model, `code quality in ${lang}${focus?', focus: '+focus:''}`);
  if (!ev.passed && ev.suggestions.length) {
    const { text: improved } = await generateText({ model, system: '资深代码专家。根据反馈改进代码，直接输出代码。', prompt: `改进${lang}代码：\n${code}\n\n反馈：${ev.issues.join(';')}\n建议：${ev.suggestions.join(';')}`, temperature: 0, maxOutputTokens: 8192 });
    return { review: ev, improvedCode: improved, iterations: 1 };
  }
  return { review: ev, iterations: 0 };
}

const classifySchema = z.object({
  type: z.enum(['coding','writing','analysis','chat','research']),
  complexity: z.enum(['simple','moderate','complex']),
  suggestedMode: z.string(),
});

export async function classifyQuery(q: string, model: any): Promise<{type:string;complexity:string;suggestedMode:string}> {
  try {
    const result = await generateObject({ model, schema: classifySchema, system: '任务分类器。', prompt: `分类：${q.slice(0,500)}`, temperature: 0 });
    return result.object as any;
  } catch { return { type: 'chat', complexity: 'simple', suggestedMode: 'chat' }; }
}

export const workflowTools = {
  reviewCode: tool({
    description: '使用评估-优化工作流自动评审代码，给出评分和改进建议。',
    inputSchema: z.object({ code: z.string().describe('代码'), language: z.string().optional().describe('语言'), focus: z.string().optional().describe('重点：security/performance/readability') }),
    execute: async ({ code, language, focus }) => {
      const model = await getLightModel();
      if (!model) return '评审模型不可用';
      const r = await reviewCodeWithWorkflow(code, model, language||'TypeScript', focus);
      let out = `评审（${r.review.qualityScore}/10）：\n`;
      if (r.review.strengths.length) out += `优点：${r.review.strengths.join('; ')}\n`;
      if (r.review.issues.length) out += `问题：${r.review.issues.join('; ')}\n`;
      if (r.review.suggestions.length) out += `建议：${r.review.suggestions.join('; ')}\n`;
      if (r.improvedCode) out += `\n改进代码：\n\`\`\`\n${r.improvedCode}\n\`\`\``;
      return out;
    },
  }),
  classifyTask: tool({
    description: '分析查询，判断任务类型和复杂度。',
    inputSchema: z.object({ query: z.string().describe('查询内容') }),
    execute: async ({ query: q }) => {
      const model = await getLightModel();
      if (!model) return '分类模型不可用';
      const r = await classifyQuery(q, model);
      return `类型: ${r.type}\n复杂度: ${r.complexity}\n推荐: ${r.suggestedMode}`;
    },
  }),
};
