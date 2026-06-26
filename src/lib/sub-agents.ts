import { generateText, tool } from 'ai';
import { z } from 'zod';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getApiKeyByProvider, getModelConfig } from '@/lib/db';

async function getSubModel() {
  for (const mid of ['deepseek-v4-flash', 'glm-5-turbo', 'qwen-3.7-flash']) {
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

export const subAgentTools = {
  delegateResearch: tool({
    description: '委派深度研究任务给子智能体，返回精炼结果。适合需要大量探索的问题。',
    inputSchema: z.object({ task: z.string().describe('研究任务'), scope: z.string().optional().describe('范围约束') }),
    execute: async ({ task, scope }) => {
      const m = await getSubModel();
      if (!m) return '研究子智能体不可用';
      try {
        const { text } = await generateText({ model: m, system: '研究助理。独立完成后给出结构化总结（500字内）。', prompt: `研究：${task}${scope?'\n范围：'+scope:''}`, maxOutputTokens: 4096, temperature: 0.2 });
        return text || '研究完成';
      } catch (e: any) { return `研究失败: ${e.message}`; }
    },
  }),
  exploreCode: tool({
    description: '委派代码探索任务给子智能体。读取分析项目文件，返回结构分析。',
    inputSchema: z.object({ task: z.string().describe('探索任务'), files: z.array(z.string()).optional().describe('文件路径列表') }),
    execute: async ({ task, files }) => {
      const m = await getSubModel();
      if (!m) return '代码探索不可用';
      const fs = await import('fs/promises');
      let fc = '';
      if (files) for (const f of files.slice(0,10)) { try { const c = await fs.readFile(`/www/wwwroot/agent.piyiguo.com/${f}`, 'utf-8'); fc += `\n--- ${f} ---\n${c.slice(0,5000)}\n`; } catch { fc += `\n--- ${f} --- (无法读取)\n`; } }
      try {
        const { text } = await generateText({ model: m, system: '代码分析专家。分析结构和架构，指出问题和改进点。', prompt: `任务：${task}\n${fc?'\n文件：\n'+fc.slice(0,20000):''}`, maxOutputTokens: 4096, temperature: 0 });
        return text || '分析完成';
      } catch (e: any) { return `分析失败: ${e.message}`; }
    },
  }),
  parallelResearch: tool({
    description: '从多个角度并行研究一个主题，汇总报告。',
    inputSchema: z.object({ topic: z.string().describe('主题'), angles: z.array(z.string()).describe('研究角度列表') }),
    execute: async ({ topic, angles }) => {
      const m = await getSubModel();
      if (!m) return '并行研究不可用';
      const studies = await Promise.all(angles.slice(0,4).map(async (a) => {
        try { const { text } = await generateText({ model: m, system: '专题研究员。200字内给出关键发现。', prompt: `主题：${topic}\n角度：${a}`, maxOutputTokens: 1000, temperature: 0.2 }); return `[${a}]\n${text}`; } catch { return `[${a}]\n失败`; }
      }));
      try { const { text } = await generateText({ model: m, system: '研究总结专家。综合成结构化报告。', prompt: `主题：${topic}\n\n${studies.join('\n\n')}`, maxOutputTokens: 2000, temperature: 0.1 }); return text || studies.join('\n\n'); } catch { return studies.join('\n\n'); }
    },
  }),
  delegateAnalysis: tool({
    description: '委派数据分析或复杂推理任务给子智能体。',
    inputSchema: z.object({ task: z.string().describe('分析任务'), data: z.string().optional().describe('数据/文本') }),
    execute: async ({ task, data }) => {
      const m = await getSubModel();
      if (!m) return '分析子智能体不可用';
      try { const { text } = await generateText({ model: m, system: '数据分析专家。给出核心发现、趋势、建议。', prompt: `任务：${task}${data?'\n数据：\n'+data.slice(0,10000):''}`, maxOutputTokens: 4096, temperature: 0.1 }); return text || '分析完成'; } catch (e: any) { return `分析失败: ${e.message}`; }
    },
  }),
};
