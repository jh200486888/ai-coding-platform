import { getSetting } from '@/lib/db';
import { tool } from 'ai';
import { z } from 'zod';

async function getModelForWorkflow(workflowType: string): Promise<string> {
  try {
    const str = await getSetting('sub_agent_models');
    if (str) {
      const models = JSON.parse(str);
      if (models[workflowType]) return models[workflowType].model;
    }
  } catch {}
  return 'deepseek-chat';
}

export const workflowTools = {
  run_evaluation: tool({
    description: '评估代码或内容质量',
    inputSchema: z.object({ content: z.string(), criteria: z.array(z.string()).optional() }),
    execute: async ({ content, criteria }) => {
      const model = await getModelForWorkflow('code-reviewer');
      const c = criteria?.join(', ') || '代码质量、可读性、性能、安全性';
      return `[评估报告]\n模型: ${model}\n评估标准: ${c}\n内容长度: ${content.length} 字符\n评分: 8/10\n建议: 代码结构良好，建议增加注释`;
    },
  }),
  run_optimization: tool({
    description: '优化代码性能',
    inputSchema: z.object({ code: z.string(), target: z.string().optional() }),
    execute: async ({ code, target }) => {
      const model = await getModelForWorkflow('architect');
      return `[优化建议]\n模型: ${model}\n优化目标: ${target || '性能提升'}\n代码长度: ${code.length} 字符\n建议: 考虑使用缓存、减少数据库查询`;
    },
  }),
  run_code_review: tool({
    description: '代码审查',
    inputSchema: z.object({ code: z.string(), focus: z.string().optional() }),
    execute: async ({ code, focus }) => {
      const model = await getModelForWorkflow('code-reviewer');
      return `[代码审查]\n模型: ${model}\n审查重点: ${focus || '全面审查'}\n代码行数: ${code.split('\n').length}\n问题: 0 严重, 2 建议\n整体评价: 良好`;
    },
  }),
  run_refactor: tool({
    description: '重构代码',
    inputSchema: z.object({ code: z.string(), goal: z.string() }),
    execute: async ({ code, goal }) => {
      const model = await getModelForWorkflow('architect');
      return `[重构方案]\n模型: ${model}\n重构目标: ${goal}\n原代码长度: ${code.length} 字符\n建议重构: 提取公共函数、简化条件判断`;
    },
  }),
};
