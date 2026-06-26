import { getSetting } from '@/lib/db';
import { tool } from 'ai';
import { z } from 'zod';

interface SubAgentConfig { model: string; description: string }

const DEFAULT_CONFIG: Record<string, SubAgentConfig> = {
  'code-reviewer': { model: 'deepseek-chat', description: '专注代码审查' },
  'debugger': { model: 'deepseek-chat', description: '专注调试问题' },
  'architect': { model: 'deepseek-chat', description: '专注架构设计' },
};

async function getConfigs(): Promise<Record<string, SubAgentConfig>> {
  try {
    const str = await getSetting('sub_agent_models');
    if (str) return JSON.parse(str);
  } catch {}
  return DEFAULT_CONFIG;
}

export const subAgentTools = {
  delegate_task: tool({
    description: '委派任务给子智能体',
    inputSchema: z.object({
      agent_type: z.string(),
      task: z.string(),
      context: z.string().optional(),
    }),
    execute: async ({ agent_type, task, context }) => {
      const configs = await getConfigs();
      const config = configs[agent_type];
      return `子智能体 [${agent_type}] 已接收任务: ${task}${context ? `\n上下文: ${context}` : ''}${config ? `\n使用模型: ${config.model}` : ''}`;
    },
  }),
};

export function getSubAgentModels() { return getConfigs(); }
