// @ts-nocheck
/**
 * Proactive Reasoning Engine
 * Analyzes conversation state and tool results to generate intelligent hints.
 * Injected into the agent loop to make the AI proactively:
 * - Suggest verification after changes
 * - Warn about risks
 * - Recommend next steps
 * - Detect patterns and offer insights
 */

interface ProactiveHint {
  type: 'suggest' | 'warn' | 'remind' | 'escalate';
  message: string;
  priority: number; // 1-5, higher = more important
}

// ============ Tool Result Analysis ============
// Generates hints after each tool execution

export function analyzeToolResult(
  toolName: string,
  input: Record<string, any>,
  output: string,
  isSuccess: boolean,
  recentToolHistory: string[] = []
): ProactiveHint[] {
  const hints: ProactiveHint[] = [];
  const cmd = String(input.command || input.cmd || '').trim();

  if (!isSuccess) {
    // === Failure patterns ===
    if (toolName === 'build_project') {
      hints.push({
        type: 'suggest',
        message: '构建失败后建议：1) 用 ssh_read_file 读取出错文件检查语法 2) 检查 import 路径是否正确 3) 查看完整错误日志定位根因',
        priority: 4,
      });
    }
    if (toolName === 'deploy_service') {
      hints.push({
        type: 'suggest',
        message: '部署失败后建议：1) 用 ssh_execute 执行 "pm2 logs --lines 30" 查看启动日志 2) 检查端口是否被占用 "ss -tlnp | grep :5000" 3) 确认 .next 构建产物完整',
        priority: 4,
      });
    }
    if (toolName === 'ssh_execute' && output.includes('permission denied')) {
      hints.push({
        type: 'warn',
        message: '检测到权限拒绝错误。检查是否需要对目标路径使用 sudo，或确认当前用户是否有写权限。',
        priority: 3,
      });
    }
    if (toolName === 'ssh_execute' && output.includes('ECONNREFUSED')) {
      hints.push({
        type: 'warn',
        message: '连接被拒绝。目标服务可能未启动或端口不正确。建议用 "pm2 status" 检查进程状态，或用 "ss -tlnp" 确认端口监听。',
        priority: 3,
      });
    }
    return hints;
  }

  // === Success patterns: suggest follow-up actions ===

  // File write → suggest verification
  if (['ssh_write_file', 'createFile', 'runCommand'].includes(toolName)) {
    let filePath = String(input.path || '').trim();
    if (!filePath && toolName === 'runCommand') {
      const cmdStr = String(input.command || '');
      const pathMatch = cmdStr.match(/(?:>|>>|tee)\s*['"]?(\/[\w./-]+\.\w+)/);
      if (pathMatch) filePath = pathMatch[1];
    }
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.py') || filePath.endsWith('.sh') || filePath.endsWith('.go') || filePath.endsWith('.rs') || filePath.endsWith('.java') || filePath.endsWith('.vue') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      hints.push({
        type: 'suggest',
        message: `代码文件已写入。建议主动执行验证：1) 用 build_project 检查编译是否通过 2) 如果有测试文件，用 run_tests 运行测试`,
        priority: 3,
      });
    }
  }

  // File edit → suggest verification
  if (toolName === 'editFile' || (toolName === 'runCommand' && String(input.command || '').includes('sed '))) {
    hints.push({
      type: 'suggest',
      message: '文件已修改。建议用 build_project 验证编译，或用 ssh_execute 运行相关测试确认修改无误。',
      priority: 3,
    });
  }

  // Build success → suggest deploy
  if (toolName === 'build_project') {
    hints.push({
      type: 'suggest',
      message: '✅ 构建成功！建议接下来：1) 用 deploy_service 部署到生产环境 2) 部署后用 health_check 验证服务正常',
      priority: 2,
    });
  }

  // Deploy success → suggest health check + log review
  if (toolName === 'deploy_service') {
    hints.push({
      type: 'suggest',
      message: '✅ 部署成功！建议主动检查：1) 用 health_check 确认服务健康 2) 用 ssh_execute 执行 "pm2 logs --lines 20" 查看是否有运行时错误 3) 访问前端页面确认功能正常',
      priority: 3,
    });
  }

  // Git commit → suggest push if appropriate
  if (toolName === 'git_commit') {
    hints.push({
      type: 'remind',
      message: '代码已提交到本地仓库。如需推送到远程仓库，请执行 git push。',
      priority: 1,
    });
  }

  // ssh_execute: detect file writes via redirect/heredoc
  if (toolName === 'ssh_execute' && isSuccess) {
    const isFileWrite = /(cat\s+.*>\s*|echo\s+.*>\s*|tee\s+|<<\s*['"]?EOF|cp\s+|mv\s+)/.test(cmd);
    const writesCodeFile = isFileWrite && /\.(ts|tsx|js|jsx|py|go|rs|java|vue|html|css)/.test(cmd);
    if (isFileWrite) {
      hints.push({
        type: 'suggest',
        message: writesCodeFile
          ? '文件已写入。建议主动验证：用 build_project 检查编译，或用 run_tests 运行测试。'
          : '文件操作已完成。建议用 cat 验证内容正确性。',
        priority: 3,
      });
    }
    if (/(npm|pnpm|yarn)\s+(install|add)/.test(cmd)) {
      hints.push({
        type: 'suggest',
        message: '依赖已安装。如果是生产环境，建议重新构建并部署。',
        priority: 2,
      });
    }
    if (/git\s+commit/.test(cmd)) {
      hints.push({
        type: 'remind',
        message: '代码已提交。如需同步远程仓库，请执行 git push。',
        priority: 1,
      });
    }
  }

  // Dangerous command executed successfully → warn about side effects
  if (toolName === 'ssh_execute') {
    if (/rm\s+(-rf?\s+)?/.test(cmd) && !cmd.includes('/tmp/')) {
      hints.push({
        type: 'warn',
        message: '已执行删除命令。建议确认目标路径的数据不再需要，或快照备份已就绪。',
        priority: 2,
      });
    }
    if (/DROP\s+TABLE|TRUNCATE/i.test(cmd)) {
      hints.push({
        type: 'warn',
        message: '已执行数据库结构变更。建议：1) 验证数据完整性 2) 确认自动快照已保存（/tmp/agent-snapshots/）',
        priority: 3,
      });
    }
    if (/pm2\s+restart|pm2\s+delete/i.test(cmd)) {
      hints.push({
        type: 'suggest',
        message: 'PM2 进程已变更。建议用 "pm2 status" 确认进程状态，用 "pm2 logs --lines 10" 检查是否有启动错误。',
        priority: 2,
      });
    }
  }

  // Generate document/ppt/excel → suggest delivery
  if (['generate_document', 'generate_ppt', 'generate_excel'].includes(toolName)) {
    hints.push({
      type: 'remind',
      message: '文档已生成。请告诉用户文档ID和下载方式，方便他们获取文件。',
      priority: 2,
    });
  }

  // Multiple tools without verification → remind
  if (recentToolHistory.length >= 3) {
    const lastThree = recentToolHistory.slice(-3);
    const writeTools = lastThree.filter(t =>
      ['ssh_write_file', 'createFile', 'editFile', 'ssh_execute'].includes(t)
    );
    const verifyTools = lastThree.filter(t =>
      ['build_project', 'health_check', 'run_tests', 'verify_operation'].includes(t)
    );
    if (writeTools.length >= 2 && verifyTools.length === 0) {
      hints.push({
        type: 'remind',
        message: '已执行多次写操作但未验证。建议用 build_project 或 run_tests 验证变更是否正确。',
        priority: 3,
      });
    }
  }

  return hints;
}

// ============ Conversation State Analysis ============
// Generates hints before each agent step

export function analyzeConversationState(
  messages: any[],
  stepNumber: number,
  toolHistory: string[] = []
): ProactiveHint[] {
  const hints: ProactiveHint[] = [];

  if (stepNumber < 2 || messages.length < 2) return hints;

  // Get recent tool calls from messages
  const recentTools: string[] = [];
  for (const msg of messages.slice(-10)) {
    const parts = msg.parts || msg.content || [];
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (p.type === 'tool-invocation' || p.type?.startsWith('tool-')) {
          const name = p.toolName || p.name || '';
          if (name) recentTools.push(name);
        }
      }
    }
  }

  // Pattern: Agent completed a complex task → suggest reflection
  if (stepNumber > 5 && recentTools.length > 4) {
    const hasWrite = recentTools.some(t => ['ssh_write_file', 'createFile', 'editFile'].includes(t));
    const hasBuild = recentTools.includes('build_project');
    const hasDeploy = recentTools.includes('deploy_service');
    if (hasWrite && hasBuild && hasDeploy) {
      hints.push({
        type: 'suggest',
        message: '你已完成一个完整的开发-构建-部署流程。如果这是首次执行且结果良好，建议调用 save_learned_skill 将此流程保存为可复用技能，方便下次快速执行。',
        priority: 2,
      });
    }
  }

  // Pattern: Many read operations without action → suggest next step
  if (recentTools.length >= 3) {
    const readTools = recentTools.filter(t =>
      ['ssh_read_file', 'readFile', 'read_url', 'smart_search', 'web_search'].includes(t)
    );
    if (readTools.length >= 3 && !recentTools.some(t =>
      ['ssh_write_file', 'createFile', 'editFile', 'ssh_execute'].includes(t)
    )) {
      hints.push({
        type: 'suggest',
        message: '已收集了足够信息。建议开始执行具体操作（写代码、修改文件等），而不是继续搜索。',
        priority: 2,
      });
    }
  }

  // Pattern: Same tool called 3+ times → suggest different approach
  const toolCounts: Record<string, number> = {};
  recentTools.forEach(t => { toolCounts[t] = (toolCounts[t] || 0) + 1; });
  for (const [tool, count] of Object.entries(toolCounts)) {
    if (count >= 3 && tool !== 'smart_search' && tool !== 'web_search') {
      hints.push({
        type: 'escalate',
        message: `${tool} 已调用 ${count} 次。如果反复失败，建议：1) 换一个工具或方法 2) 仔细分析错误原因后再试 3) 如确实无法解决，坦诚告知用户限制`,
        priority: 4,
      });
      break; // Only one escalation hint
    }
  }

  return hints;
}

// ============ Format hints for injection ============

export function formatHints(hints: ProactiveHint[]): string {
  if (hints.length > 0) {
    console.log('[Proactive] Generated ' + hints.length + ' hints: ' + hints.map(h => h.type + '(' + h.priority + ')').join(', '));
  }
  if (hints.length === 0) return '';

  // Sort by priority (highest first), deduplicate similar messages
  const sorted = hints.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const unique = sorted.filter(h => {
    const key = h.message.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Limit to 2 hints to avoid overwhelming the agent
  const top = unique.slice(0, 2);

  const prefix = '\n\n[主动推理建议] ';
  return prefix + top.map(h => {
    const icon = h.type === 'warn' ? '⚠️' : h.type === 'escalate' ? '🚨' : h.type === 'remind' ? '💡' : '📋';
    return `${icon} ${h.message}`;
  }).join('\n');
}
