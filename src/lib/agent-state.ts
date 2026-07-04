// @ts-nocheck
/**
 * Agent State Machine - 对话级状态机
 * 每次工具调用后自动记录状态到DB，下次对话开头自动恢复
 * 支持跨对话记忆持久化、状态追踪、进度恢复
 */
import { query, queryOne, run, getSetting } from '@/lib/db';
import { logger } from './logger';


// ============ 配置读取（从DB读取，有默认值） ============
async function getAdvancedConfig(): Promise<Record<string, any>> {
  try {
    const advStr = await getSetting('advanced_config');
    if (!advStr) return {};
    const cleaned = advStr.replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"');
    return JSON.parse(cleaned);
  } catch { return {}; }
}

async function getConfig(key: string, defaultValue: any): Promise<any> {
  const config = await getAdvancedConfig();
  return config[key] ?? defaultValue;
}

// ============ 状态类型 ============
export type AgentPhase = 'idle' | 'planning' | 'executing' | 'reviewing' | 'waiting_input' | 'stuck' | 'completed';

export interface AgentState {
  id: string;
  conversation_id: string;
  phase: AgentPhase;
  current_task: string;         // 当前在做什么
  blocked_reason?: string;      // 卡在哪
  next_step?: string;           // 下一步是什么
  progress_pct: number;         // 0-100
  tool_history: ToolCallRecord[]; // 工具调用历史
  key_decisions: string[];      // 关键决策记录
  artifacts: string[];          // 产出物列表
  error_count: number;          // 连续错误次数
  last_error?: string;          // 最近一次错误
  active_plan?: TaskPlan | null;  // 当前任务计划
  created_at: Date;
  updated_at: Date;
}

export interface ToolCallRecord {
  tool: string;
  input_summary: string;  // 输入摘要（<=200字）
  result_summary: string; // 输出摘要（<=200字）
  success: boolean;
  timestamp: string;
  duration_ms?: number;
}


// ============ 任务计划系统 ============
export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  result?: string;
}

export interface TaskPlan {
  goal: string;
  steps: PlanStep[];
  current_step_index: number;
  created_at: string;
}

// ============ DB操作 ============
export async function initAgentStateTable(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS agent_state (
      id VARCHAR(64) PRIMARY KEY,
      conversation_id VARCHAR(64) NOT NULL,
      phase VARCHAR(32) DEFAULT 'idle',
      current_task TEXT DEFAULT '',
      blocked_reason TEXT,
      next_step TEXT,
      progress_pct INTEGER DEFAULT 0,
      tool_history JSONB DEFAULT '[]',
      key_decisions JSONB DEFAULT '[]',
      artifacts JSONB DEFAULT '[]',
      error_count INTEGER DEFAULT 0,
      last_error TEXT,
      active_plan JSONB DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // 索引
  await run(`CREATE INDEX IF NOT EXISTS idx_agent_state_conv ON agent_state(conversation_id)`).catch(() => {});
  logger.info('[AgentState] Table initialized');
}

// ============ 状态管理 ============
export async function getAgentState(conversationId: string): Promise<AgentState | null> {
  const row = await queryOne(
    'SELECT * FROM agent_state WHERE conversation_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [conversationId]
  );
  if (!row) return null;
  return {
    ...row,
    tool_history: typeof row.tool_history === 'string' ? JSON.parse(row.tool_history) : (row.tool_history || []),
    key_decisions: typeof row.key_decisions === 'string' ? JSON.parse(row.key_decisions) : (row.key_decisions || []),
    artifacts: typeof row.artifacts === 'string' ? JSON.parse(row.artifacts) : (row.artifacts || []),
    active_plan: typeof row.active_plan === 'string' ? JSON.parse(row.active_plan) : (row.active_plan || null),
  };
}

export async function saveAgentState(state: Partial<AgentState> & { conversation_id: string }): Promise<void> {
  const existing = await getAgentState(state.conversation_id);
  const id = existing?.id || ('astate_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  
  const fields = {
    phase: state.phase || existing?.phase || 'idle',
    current_task: state.current_task ?? existing?.current_task ?? '',
    blocked_reason: state.blocked_reason ?? existing?.blocked_reason ?? null,
    next_step: state.next_step ?? existing?.next_step ?? null,
    progress_pct: state.progress_pct ?? existing?.progress_pct ?? 0,
    tool_history: JSON.stringify(state.tool_history ?? existing?.tool_history ?? []),
    key_decisions: JSON.stringify(state.key_decisions ?? existing?.key_decisions ?? []),
    artifacts: JSON.stringify(state.artifacts ?? existing?.artifacts ?? []),
    error_count: state.error_count ?? existing?.error_count ?? 0,
    last_error: state.last_error ?? existing?.last_error ?? null,
    active_plan: state.active_plan ? JSON.stringify(state.active_plan) : (existing?.active_plan ? JSON.stringify(existing.active_plan) : null),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await run(
      `UPDATE agent_state SET phase=$2, current_task=$3, blocked_reason=$4, next_step=$5, 
       progress_pct=$6, tool_history=$7, key_decisions=$8, artifacts=$9, error_count=$10, 
       last_error=$11, active_plan=$12, updated_at=$13 WHERE id=$1`,
      [id, fields.phase, fields.current_task, fields.blocked_reason, fields.next_step,
       fields.progress_pct, fields.tool_history, fields.key_decisions, fields.artifacts,
       fields.error_count, fields.last_error, fields.active_plan, fields.updated_at]
    );
  } else {
    await run(
      `INSERT INTO agent_state (id, conversation_id, phase, current_task, blocked_reason, next_step,
       progress_pct, tool_history, key_decisions, artifacts, error_count, last_error, active_plan, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14)`,
      [id, state.conversation_id, fields.phase, fields.current_task, fields.blocked_reason,
       fields.next_step, fields.progress_pct, fields.tool_history, fields.key_decisions,
       fields.artifacts, fields.error_count, fields.last_error, fields.active_plan, fields.updated_at]
    );
  }
}

// ============ 工具调用追踪 ============
export async function recordToolCall(
  conversationId: string,
  toolName: string,
  inputSummary: string,
  resultSummary: string,
  success: boolean,
  durationMs?: number
): Promise<void> {
  const state = await getAgentState(conversationId);
  const record: ToolCallRecord = {
    tool: toolName,
    input_summary: inputSummary.slice(0, 200),
    result_summary: resultSummary.slice(0, 200),
    success,
    timestamp: new Date().toISOString(),
    duration_ms: durationMs,
  };

  const toolHistory = state?.tool_history || [];
  toolHistory.push(record);
  // 保留最近N条（从DB配置读取）
  const historyLimit = await getConfig('tool_history_limit', 50);
  if (toolHistory.length > historyLimit) toolHistory.splice(0, toolHistory.length - historyLimit);

  const errorCount = success ? 0 : (state?.error_count || 0) + 1;
  const stuckThreshold = await getConfig('error_threshold_stuck', 3);
  const phase = errorCount >= stuckThreshold ? 'stuck' : (state?.phase || 'executing');

  await saveAgentState({
    conversation_id: conversationId,
    phase: phase as AgentPhase,
    tool_history: toolHistory,
    error_count: errorCount,
    last_error: success ? undefined : resultSummary.slice(0, 500),
  });
}

// ============ 生成状态摘要（注入到system prompt） ============
// ============ 任务计划管理 ============
export async function createTaskPlan(
  conversationId: string, 
  goal: string, 
  stepDescriptions: string[]
): Promise<TaskPlan> {
  const plan: TaskPlan = {
    goal,
    steps: stepDescriptions.map((desc, i) => ({
      id: `step_${i + 1}`,
      description: desc,
      status: 'pending' as const,
    })),
    current_step_index: 0,
    created_at: new Date().toISOString(),
  };
  
  await saveAgentState({
    conversation_id: conversationId,
    phase: 'planning',
    current_task: goal,
    active_plan: plan,
    progress_pct: 0,
  });
  
  return plan;
}

export async function updatePlanStep(
  conversationId: string,
  stepId: string,
  status: PlanStep['status'],
  result?: string
): Promise<TaskPlan | null> {
  const state = await getAgentState(conversationId);
  if (!state?.active_plan) return null;
  
  const plan = state.active_plan;
  const stepIndex = plan.steps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) return null;
  
  plan.steps[stepIndex].status = status;
  if (result) plan.steps[stepIndex].result = result.slice(0, 500);
  
  const nextPending = plan.steps.findIndex(s => s.status === 'pending');
  plan.current_step_index = nextPending >= 0 ? nextPending : plan.steps.length;
  
  const completed = plan.steps.filter(s => s.status === 'completed').length;
  const progressPct = Math.round((completed / plan.steps.length) * 100);
  
  const allDone = plan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
  const hasFailed = plan.steps.some(s => s.status === 'failed');
  const phase = allDone ? 'completed' : (hasFailed ? 'stuck' : 'executing');
  
  await saveAgentState({
    conversation_id: conversationId,
    phase,
    active_plan: plan,
    progress_pct: progressPct,
    current_task: allDone ? plan.goal + ' (已完成)' : '步骤' + (stepIndex + 1) + '/' + plan.steps.length + ': ' + plan.steps[stepIndex].description,
  });
  
  return plan;
}

export async function getActivePlan(conversationId: string): Promise<TaskPlan | null> {
  const state = await getAgentState(conversationId);
  return state?.active_plan || null;
}

// ============ 主动反思与调度 ============
export interface ReflectionResult {
  summary: string;
  suggested_followups: Array<{
    task_name: string;
    task_description: string;
    cron_expression: string;
    reason: string;
  }>;
}

export async function reflectAndSave(
  conversationId: string,
  summary: string,
  keyDecisions: string[]
): Promise<void> {
  const state = await getAgentState(conversationId);
  const existingDecisions = state?.key_decisions || [];
  await saveAgentState({
    conversation_id: conversationId,
    key_decisions: [...existingDecisions, ...keyDecisions.map(d => d.slice(0, 200))],
    phase: 'completed',
    progress_pct: 100,
  });
}

export async function getStateContext(conversationId: string): Promise<string> {
  const state = await getAgentState(conversationId);
  if (!state || state.phase === 'idle') return '';

  const lines: string[] = ['\n\n## 当前任务状态（自动恢复）'];
  lines.push(`- 阶段: ${state.phase}`);
  if (state.current_task) lines.push(`- 当前任务: ${state.current_task}`);
  if (state.blocked_reason) lines.push(`- 卡点: ${state.blocked_reason}`);
  if (state.next_step) lines.push(`- 下一步: ${state.next_step}`);
  if (state.progress_pct > 0) lines.push(`- 进度: ${state.progress_pct}%`);
  
  // 最近工具调用
  const recentTools = state.tool_history.slice(-5);
  if (recentTools.length > 0) {
    lines.push('- 最近操作:');
    for (const t of recentTools) {
      const icon = t.success ? '✅' : '❌';
      lines.push(`  ${icon} ${t.tool}: ${t.result_summary.slice(0, 80)}`);
    }
  }

  // 关键决策
  if (state.key_decisions.length > 0) {
    lines.push('- 关键决策:');
    for (const d of state.key_decisions.slice(-3)) {
      lines.push(`  • ${d.slice(0, 100)}`);
    }
  }

  // 错误状态
  const stuckThreshold = await getConfig('error_threshold_stuck', 3);
  if (state.error_count >= stuckThreshold) {
    lines.push(`- ⚠️ 连续${state.error_count}次错误，需要换策略！`);
    if (state.last_error) lines.push(`  最近错误: ${state.last_error.slice(0, 150)}`);
  }

  // 任务计划进度
  if (state.active_plan) {
    const plan = state.active_plan;
    lines.push('');
    lines.push('## 当前任务计划');
    lines.push('目标: ' + plan.goal);
    for (const step of plan.steps) {
      const statusIcon = step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '🔄' : step.status === 'failed' ? '❌' : step.status === 'skipped' ? '⏭️' : '⬜';
      lines.push('  ' + statusIcon + ' [' + step.id + '] ' + step.description + (step.result ? ' → ' + step.result.slice(0, 80) : ''));
    }
    const planCompleted = plan.steps.filter(s => s.status === 'completed').length;
    lines.push('进度: ' + planCompleted + '/' + plan.steps.length + ' 步骤完成');
  }

  lines.push('\n请基于以上状态继续执行，不要重复已完成的步骤。如果当前有任务计划，按计划依次执行。');

  return lines.join('\n');
}

// ============ 跨对话记忆 ============
export async function extractAndSaveProgress(
  conversationId: string,
  model: any,
  conversationSummary: string,
  toolResults: string[]
): Promise<void> {
  // 从对话中提取关键进度，写入user_memory
  if (!conversationSummary && toolResults.length === 0) return;

  const contextToSave = toolResults.length > 0
    ? conversationSummary + '\n\n工具执行结果:\n' + toolResults.map((r, i) => `${i+1}. ${r.slice(0, 300)}`).join('\n')
    : conversationSummary;

  // 提取关键信息的prompt
  const extractPrompt = `从以下对话内容中提取值得长期记住的关键信息，格式为JSON数组：
[{"category":"project/preference/fact/decision","content":"具体内容","importance":1-10,"keywords":"关键词,逗号分隔"}]

只提取真正重要、后续可能复用的信息。忽略临时中间步骤。
对话内容：
${contextToSave.slice(0, (await getConfig('memory_extract_max_length', 3000)))}`;

  try {
    const { generateText } = await import('ai');
    const result = await generateText({
      model,
      system: '你是一个信息提取助手。只输出JSON数组，不要其他文字。',
      prompt: extractPrompt,
      maxTokens: 1000,
      temperature: 0,
    });

    const text = result.text?.trim() || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[0]);
      for (const item of items) {
        if (item.content && item.content.length > 5) {
          const id = 'mem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          await run(
            'INSERT INTO user_memory (id, category, content, importance, keywords, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
            [id, item.category || 'note', item.content.slice(0, 500), item.importance || 5, item.keywords || '']
          ).catch(() => {}); // dedup by catching
        }
      }
      logger.info(`[AgentState] Extracted ${items.length} memory items from conversation ${conversationId}`);
    }
  } catch (e: any) {
    logger.info(`[AgentState] Memory extraction failed: ${e.message}`);
  }
}

// ============ 定时任务 ============
export async function initScheduledTasksTable(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id VARCHAR(64) PRIMARY KEY,
      conversation_id VARCHAR(64),
      task_name VARCHAR(200) NOT NULL,
      task_description TEXT NOT NULL,
      cron_expression VARCHAR(100),
      next_run_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      status VARCHAR(20) DEFAULT 'active',
      run_count INTEGER DEFAULT 0,
      max_runs INTEGER,
      result_summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks(status)`).catch(() => {});
  await run(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at)`).catch(() => {});
  logger.info('[AgentState] scheduled_tasks table initialized');
}

export interface ScheduledTask {
  id: string;
  conversation_id?: string;
  task_name: string;
  task_description: string;
  cron_expression: string;
  next_run_at?: Date;
  last_run_at?: Date;
  status: 'active' | 'paused' | 'completed' | 'failed';
  run_count: number;
  max_runs?: number;
  result_summary?: string;
}

export async function createScheduledTask(task: { conversation_id?: string; task_name: string; task_description: string; cron_expression: string; status?: string; max_runs?: number }): Promise<string> {
  const id = 'cron_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nextRun = computeNextRun(task.cron_expression);
  await run(
    `INSERT INTO scheduled_tasks (id, conversation_id, task_name, task_description, cron_expression, next_run_at, status, run_count, max_runs, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,NOW(),NOW())`,
    [id, task.conversation_id, task.task_name, task.task_description, task.cron_expression,
     nextRun?.toISOString(), task.status || 'active', task.max_runs || null]
  );
  return id;
}

export async function getDueTasks(): Promise<ScheduledTask[]> {
  const rows = await query(
    `SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run_at <= NOW() ORDER BY next_run_at ASC`
  );
  const limit = await getConfig('cron_task_limit', 10);
  return (rows as ScheduledTask[]).slice(0, limit);
}

export async function markTaskRun(taskId: string, resultSummary: string): Promise<void> {
  const task = await queryOne('SELECT * FROM scheduled_tasks WHERE id = $1', [taskId]) as ScheduledTask;
  if (!task) return;
  
  const newRunCount = task.run_count + 1;
  const isMaxReached = task.max_runs && newRunCount >= task.max_runs;
  const nextRun = isMaxReached ? null : computeNextRun(task.cron_expression);
  
  await run(
    `UPDATE scheduled_tasks SET last_run_at = NOW(), run_count = $2, next_run_at = $3, 
     status = $4, result_summary = $5, updated_at = NOW() WHERE id = $1`,
    [taskId, newRunCount, nextRun?.toISOString() || null, isMaxReached ? 'completed' : 'active',
     resultSummary.slice(0, 1000)]
  );
}

// ============ 简易Cron解析 ============
function computeNextRun(cronExpression: string): Date | null {
  // 支持简易格式: "every_N_minutes:30" "every_N_hours:2" "daily:09:00" "weekly:mon:10:00"
  const now = new Date();
  
  if (cronExpression.startsWith('every_N_minutes:')) {
    const mins = parseInt(cronExpression.split(':')[1]) || 30;
    return new Date(now.getTime() + mins * 60000);
  }
  if (cronExpression.startsWith('every_N_hours:')) {
    const hours = parseInt(cronExpression.split(':')[1]) || 1;
    return new Date(now.getTime() + hours * 3600000);
  }
  if (cronExpression.startsWith('daily:')) {
    const [_, time] = cronExpression.split(':');
    const [h, m] = (time || '09:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(h || 0, m || 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (cronExpression.startsWith('weekly:')) {
    const parts = cronExpression.split(':');
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = dayMap[(parts[1] || 'mon').toLowerCase()] ?? 1;
    const [h, m] = (parts[2] || '10:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(h || 0, m || 0, 0, 0);
    const currentDay = next.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0 || (daysAhead === 0 && next <= now)) daysAhead += 7;
    next.setDate(next.getDate() + daysAhead);
    return next;
  }
  // 默认1小时后
  return new Date(now.getTime() + 3600000);
}

// ============ 智能错误自修复策略 ============
export interface RecoveryStrategy {
  action: 'retry_same' | 'retry_different_params' | 'switch_tool' | 'degrade' | 'report_stuck' | 'ask_user';
  reason: string;
  suggested_tool?: string;
  suggested_params?: Record<string, any>;
}

export function determineRecoveryStrategy(
  toolName: string,
  error: string,
  errorCount: number,
  recentToolHistory: ToolCallRecord[]
): RecoveryStrategy {
  const consecutiveErrors = recentToolHistory.slice(-errorCount).filter(t => !t.success);
  const errLower = (error || '').toLowerCase();

  // ===== 错误分类：可重试 vs 方向性错误 =====
  const isRetryableError = 
    errLower.includes('timeout') || errLower.includes('timed out') ||
    errLower.includes('429') || errLower.includes('rate limit') || errLower.includes('too many requests') ||
    errLower.includes('econnreset') || errLower.includes('econnrefused') ||
    errLower.includes('502') || errLower.includes('503') || errLower.includes('504') ||
    errLower.includes('network') || errLower.includes('etimedout') ||
    errLower.includes('暂时') || errLower.includes('临时');

  const isDirectionalError =
    errLower.includes('not found') || errLower.includes('does not exist') || errLower.includes('不存在') ||
    errLower.includes('cannot find module') || errLower.includes('module not found') ||
    errLower.includes('type error') || errLower.includes('typeerror') || errLower.includes('is not assignable') ||
    errLower.includes('enoent') || errLower.includes('no such file') ||
    errLower.includes('syntaxerror') || errLower.includes('syntax error') ||
    errLower.includes('unexpected token') || errLower.includes('parse error') ||
    errLower.includes('permission denied') || errLower.includes('access denied') ||
    errLower.includes('api key') || errLower.includes('unauthorized') || errLower.includes('401') ||
    errLower.includes('invalid') || errLower.includes('argument');

  // ===== 可重试错误：直接重试，不改方向 =====
  if (isRetryableError && errorCount <= 2) {
    const delay = errorCount === 1 ? '等2秒' : '等5秒';
    return { action: 'retry_same', reason: `临时性错误（超时/限流/网络），${delay}后重试` };
  }

  // ===== 方向性错误：必须换路 =====
  if (isDirectionalError && errorCount <= 1) {
    // 第1次就方向错了，直接搜索正确做法
    return { action: 'switch_tool', reason: '方向性错误（API不存在/类型不匹配/文件不存在），建议搜索正确做法', suggested_tool: 'smart_search', suggested_params: { query: error.slice(0, 80) } };
  }

  // 1次错误（非分类命中）：重试相同
  if (errorCount <= 1) {
    return { action: 'retry_same', reason: '首次失败，重试一次' };
  }

  // ===== 工具特定策略 =====
  if (errorCount === 2) {
    // 读取失败 -> 换目录列表
    if (toolName === 'readFile' || toolName === 'ssh_read_file') {
      return { action: 'switch_tool', reason: '文件路径可能有误，先列出目录确认', suggested_tool: 'runCommand' };
    }
    // 编辑失败 -> 换创建
    if (toolName === 'editFile' || toolName === 'ssh_write_file') {
      return { action: 'switch_tool', reason: '精确匹配失败，改用创建/覆盖文件', suggested_tool: 'createFile' };
    }
    // 构建失败 -> 搜索
    if (errLower.includes('build') || errLower.includes('compile')) {
      return { action: 'switch_tool', reason: '构建失败，搜索错误解决方案', suggested_tool: 'smart_search', suggested_params: { query: error.slice(0, 80) } };
    }
    // 浏览器错误 -> 降级到read_url
    if (toolName.startsWith('browser_')) {
      return { action: 'switch_tool', reason: '浏览器操作失败，降级到read_url直接获取网页', suggested_tool: 'read_url' };
    }
    // 代码沙箱错误 -> 换语言或简化代码
    if (toolName === 'execute_code') {
      return { action: 'retry_different_params', reason: '沙箱执行失败，检查代码逻辑或换语言重试' };
    }
    // embedding/跨对话记忆错误 -> 降级到关键词搜索
    if (toolName === 'search_cross_memory' || toolName === 'save_cross_memory') {
      return { action: 'degrade', reason: '跨对话记忆操作失败（可能embedding API问题），降级到关键词搜索' };
    }
    // 默认：搜索 + 换参数
    return { action: 'retry_different_params', reason: '相同方法失败2次，建议先用smart_search搜索解决方案再调整参数' };
  }

  // 3次错误：强制换方案
  if (errorCount === 3) {
    return { action: 'degrade', reason: '连续3次失败，必须换方案：①换API/库 ②换实现思路 ③换技术栈 ④问用户' };
  }

  // 4次+：报告卡点
  return { action: 'report_stuck', reason: `连续${errorCount}次失败，需要用户介入` };
}

// ============ 生成恢复建议（注入到错误信息中） ============
export function getRecoveryHint(strategy: RecoveryStrategy): string {
  switch (strategy.action) {
    case 'retry_same':
      return '\n💡 建议：重试一次。';
    case 'retry_different_params':
      return `\n💡 建议：换参数重试。${strategy.reason}`;
    case 'switch_tool':
      return `\n💡 建议：换工具。${strategy.reason}${strategy.suggested_tool ? ` 改用 ${strategy.suggested_tool}` : ''}`;
    case 'degrade':
      return `\n💡 建议：降级方案。${strategy.reason}`;
    case 'report_stuck':
      return `\n⚠️ 连续多次失败，建议向用户报告卡点并请求指导。`;
    case 'ask_user':
      return `\n💡 建议：向用户确认需求或获取更多信息。`;
    default:
      return '';
  }
}
