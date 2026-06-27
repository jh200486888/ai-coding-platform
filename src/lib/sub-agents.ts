import { ToolLoopAgent, tool, readUIMessageStream, toUIMessageStream } from 'ai';
import { z } from 'zod';

// ============ 子智能体配置 ============
const SUBAGENT_CONFIGS: Record<string, {
  instructions: string;
  toolNames: string[];
}> = {
  researcher: {
    instructions: `你是一个专业的研究分析助手。你的任务是深入搜索和分析信息。

工作方式：
1. 使用搜索工具查找相关信息
2. 读取文件获取详细内容
3. 整理和分析发现
4. 给出清晰的结构化总结

【规则】
- 不要使用 Markdown 格式化
- 完成后必须给出完整的总结，包括关键发现和来源
- 总结控制在500字以内，只保留最核心的信息`,
    toolNames: ['searchWeb', 'readFile', 'runCommand'],
  },
  coder: {
    instructions: `你是一个专业的编程助手。你的任务是根据需求编写、修改或调试代码。

工作方式：
1. 先读取相关文件了解现状
2. 编写或修改代码
3. 执行命令验证结果
4. 修复发现的问题

【规则】
- 直接用工具操作，不要展示代码
- 不要使用 Markdown 格式化
- 完成后总结做了什么修改、结果如何`,
    toolNames: ['createFile', 'editFile', 'deleteFile', 'readFile', 'runCommand'],
  },
  reviewer: {
    instructions: `你是一个代码审查专家。你的任务是审查代码质量、发现问题和给出改进建议。

工作方式：
1. 读取相关代码文件
2. 分析代码质量、安全性、性能
3. 给出具体的问题列表和改进建议

【规则】
- 不要使用 Markdown 格式化
- 完成后给出完整的审查报告
- 按严重程度分级：严重/警告/建议`,
    toolNames: ['readFile', 'runCommand', 'searchWeb'],
  },
  writer: {
    instructions: `你是一个专业文案写作助手。你的任务是撰写各类文案内容。

工作方式：
1. 搜索获取参考资料
2. 根据需求撰写文案
3. 保存文件

【规则】
- 不要使用 Markdown 格式化
- 直接输出文案内容
- 完成后总结写了什么`,
    toolNames: ['searchWeb', 'createFile', 'readFile'],
  },
};

// ============ 创建委派任务工具（AI SDK 原生流式子智能体） ============
export function createSubAgentTool(model: any, baseTools: Record<string, any>) {
  return tool({
    description: '委派任务给子智能体。可用类型：researcher（研究搜索）、coder（编码实现）、reviewer（代码审查）、writer（文案写作）。适合处理复杂、多步骤的任务。子智能体会实时反馈执行进度。',
    inputSchema: z.object({
      agent_type: z.enum(['researcher', 'coder', 'reviewer', 'writer']).describe('子智能体类型'),
      task: z.string().describe('要委派的任务描述'),
      context: z.string().optional().describe('额外上下文信息'),
    }),
    // 使用普通 async 函数而非 async function*
    // AI SDK streamText 不支持 generator 作为 tool execute 返回值
    execute: async function ({ agent_type, task, context }, { abortSignal }) {
      const config = SUBAGENT_CONFIGS[agent_type];
      if (!config) {
        return `未知子智能体类型: ${agent_type}，可用: researcher, coder, reviewer, writer`;
      }

      // 为子智能体构建工具集
      const subTools: Record<string, any> = {};
      for (const name of config.toolNames) {
        if (baseTools[name]) subTools[name] = baseTools[name];
      }

      if (Object.keys(subTools).length === 0) {
        return `子智能体 ${agent_type} 无可用工具（需要: ${config.toolNames.join(', ')}）`;
      }

      // 使用 AI SDK 原生 ToolLoopAgent 创建子智能体
      const subagent = new ToolLoopAgent({
        model,
        instructions: config.instructions,
        tools: subTools,
      });

      const prompt = context ? `${task}\n\n上下文：${context}` : task;

      try {
        // 使用 stream + 累积文本的方式获取完整结果
        const result = await subagent.stream({
          prompt,
          abortSignal,
        });

        // 读取完整流式输出
        let fullText = '';
        const toolCallsLog: string[] = [];
        
        for await (const message of readUIMessageStream({
          stream: toUIMessageStream({ stream: result.stream }),
        })) {
          // 从 UIMessage 中提取文本
          const textParts = (message?.parts || []).filter((p: any) => p.type === 'text');
          const currentText = textParts.map((p: any) => p.text || '').join('');
          if (currentText) fullText = currentText;
          
          // 提取工具调用信息
          const toolParts = (message?.parts || []).filter((p: any) => 
            p.type?.startsWith('tool-') || p.type === 'dynamic-tool'
          );
          for (const tp of toolParts as any[]) {
            const name = tp.toolName || 'unknown';
            const state = tp.state || '';
            if (state === 'output-available' && !toolCallsLog.some(l => l.includes(name))) {
              const output = typeof (tp as any).output === 'string' ? (tp as any).output.slice(0, 80) : '完成';
              toolCallsLog.push(`${name}: ${output}`);
            }
          }
        }

        // 构建最终结果
        let resultText = `[子智能体 ${agent_type} 已完成]`;
        if (toolCallsLog.length > 0) {
          resultText += `\n执行了 ${toolCallsLog.length} 个工具调用`;
        }
        if (fullText) {
          resultText += `\n\n${fullText}`;
        }
        return resultText;

      } catch (e: any) {
        if (e.name === 'AbortError') {
          return '子智能体任务已取消';
        } else {
          return `子智能体执行失败: ${e.message || '未知错误'}`;
        }
      }
    },
  });
}

// 兼容旧版导出
export const subAgentTools = {};
