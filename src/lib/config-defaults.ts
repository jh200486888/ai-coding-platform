// @ts-nocheck
/**
 * Centralized Configuration Defaults
 * Single source of truth for all platform configuration.
 * All hardcoded values consolidated here — runtime overrides from DB settings table.
 *
 * DB Settings keys used:
 *   provider_urls       — provider base URL mapping (JSON)
 *   advanced_config     — max_steps, timeouts, retries, etc. (JSON)
 *   mode_tool_whitelist — per-mode tool lists (JSON)
 *   sub_agent_configs   — sub-agent instructions & tools (JSON)
 *   model_identity      — provider display names (JSON)
 *   tool_name_zh        — tool Chinese name mapping (JSON)
 *   security_config     — dangerous command patterns (JSON)
 *   patrol_config       — patrol token & settings (JSON)
 */


// ============ P1: Tool Safety Classification ============
// Three-tier safety system: safe (auto-approve), guarded (user-approval), blocked (reject)
export const DEFAULT_TOOL_SAFETY_TIERS: Record<string, { tier: string; description: string }> = {
  // === SAFE TIER: Auto-approve, no user interaction needed ===
  ssh_read_file:        { tier: 'safe', description: '只读文件操作' },
  health_check:         { tier: 'safe', description: '健康检查' },
  diagnose_error:       { tier: 'safe', description: '错误诊断' },
  smart_search:         { tier: 'safe', description: '智能搜索' },
  read_url:             { tier: 'safe', description: '读取网页' },
  analyze_image:        { tier: 'safe', description: '图片分析' },
  web_scrape:           { tier: 'safe', description: '网页抓取' },
  web_search:           { tier: 'safe', description: '联网搜索' },
  execute_code:         { tier: 'safe', description: '代码执行(沙箱)' },
  browser_navigate:     { tier: 'safe', description: '浏览器导航' },
  browser_click:        { tier: 'safe', description: '浏览器点击' },
  browser_fill:         { tier: 'safe', description: '浏览器填写' },
  browser_extract:      { tier: 'safe', description: '浏览器提取' },
  browser_screenshot:   { tier: 'safe', description: '浏览器截图' },
  browser_execute_js:   { tier: 'safe', description: '浏览器执行JS' },
  preview_html:         { tier: 'safe', description: 'HTML预览' },
  get_available_skills: { tier: 'safe', description: '获取技能列表' },
  activate_skill:       { tier: 'safe', description: '激活技能' },
  read_skill_file:      { tier: 'safe', description: '读取技能文件' },
  reflect_and_improve:  { tier: 'safe', description: '反思改进' },
  memory_maintenance:   { tier: 'safe', description: '记忆维护' },
  save_cross_memory:    { tier: 'safe', description: '保存跨会话记忆' },
  search_cross_memory:  { tier: 'safe', description: '搜索跨会话记忆' },
  list_cross_memories:  { tier: 'safe', description: '列出跨会话记忆' },
  create_dynamic_tool:  { tier: 'safe', description: '创建动态工具' },
  call_dynamic_tool:    { tier: 'safe', description: '调用动态工具' },
  list_dynamic_tools:   { tier: 'safe', description: '列出动态工具' },
  db_list_tables:       { tier: 'safe', description: '列出数据库表' },
  db_describe_table:    { tier: 'safe', description: '描述表结构' },
  db_query:             { tier: 'safe', description: '数据库查询(SELECT)' },
  db_table_data:        { tier: 'safe', description: '查看表数据' },
  github_search_code:   { tier: 'safe', description: 'GitHub代码搜索' },
  github_list_issues:   { tier: 'safe', description: '列出GitHub Issues' },
  github_list_prs:      { tier: 'safe', description: '列出Pull Requests' },
  github_get_repo:      { tier: 'safe', description: '获取仓库信息' },

  // === GUARDED TIER: Requires user approval before execution ===
  ssh_execute:          { tier: 'guarded', description: 'SSH命令执行(动态: 读操作自动放行)' },
  ssh_write_file:       { tier: 'guarded', description: '写入/修改文件' },
  build_project:        { tier: 'guarded', description: '构建项目' },
  deploy_service:       { tier: 'guarded', description: '部署服务' },
  git_commit:           { tier: 'guarded', description: 'Git提交代码' },
  delete_cross_memory:  { tier: 'guarded', description: '删除跨会话记忆' },
  github_create_issue:  { tier: 'guarded', description: '创建GitHub Issue' },
  deploy:                   { tier: 'guarded', description: '部署项目' },
  runCommand:               { tier: 'guarded', description: '执行命令' },
  deleteFile:               { tier: 'guarded', description: '删除文件' },
  editFile:                 { tier: 'guarded', description: '修改文件' },

  // === BLOCKED TIER: Currently no tools blocked by default, reserved for future use ===
  // Tools can be moved here via admin panel to completely disable them
};

// SSH execute dynamic sub-classification (safe sub-commands that auto-approve)
export const DEFAULT_SSH_SAFE_COMMANDS = [
  'ls', 'cat', 'head', 'tail', 'find', 'grep', 'pwd', 'whoami', 'echo',
  'stat', 'df', 'du', 'free', 'uptime', 'ps', 'netstat',
  'git status', 'git log', 'git diff', 'git branch', 'git remote',
  'git show', 'git tag', 'git stash list',
  'node -v', 'npm -v', 'pnpm -v',
  'which', 'type', 'file', 'wc', 'hostname', 'uname', 'date',
  'lsblk', 'lscpu', 'meminfo', 'top -bn1', 'ss -tlnp',
  'pm2 list', 'pm2 status', 'pm2 logs',
  'env', 'printenv', 'id', 'groups', 'last',
  'docker ps', 'docker images', 'docker logs', 'docker inspect',
];

// ============ Provider URLs (default fallback) ============
export const DEFAULT_PROVIDER_URLS: Record<string, string> = {
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
  agnes: 'https://apihub.agnes-ai.com/v1',
  'agnes-image': 'https://apihub.agnes-ai.com/v1',
  volc: 'https://ark.cn-beijing.volces.com/api/v3',
};

// ============ Runtime Config Defaults ============
export const DEFAULT_RUNTIME_CONFIG = {
  max_steps: 30,
  max_steps_workspace: 20,
  timeout_total_ms: 120000,
  timeout_step_ms: 180000,
  max_retries: 3,
  default_temperature: 0.3,
  max_output_tokens: 16384,
  topP: 0.9,
  presencePenalty: 0,
  frequencyPenalty: 0,
  seed: -1,
  max_tool_output_chars: 8000,
  context_compress_threshold: 80000,
  context_compress_ratio: 0.5,
  tool_history_limit: 50,
  cron_task_limit: 10,
  cron_secret: 'ai-platform-cron-2026',
  error_threshold_stuck: 3,
  memory_extract_max_length: 3000,
};

// ============ Provider Max Tokens Defaults ============
export const DEFAULT_PROVIDER_MAX_TOKENS: Record<string, number> = {
  deepseek: 16384, groq: 8192, moonshot: 8192, zhipu: 8192,
  qwen: 8192, openai: 16384, anthropic: 16384, google: 8192,
  doubao: 8192, agnes: 16384, 'agnes-image': 4096,
};

// ============ Workspace Provider Max Tokens ============
export const DEFAULT_WS_PROVIDER_MAX_TOKENS: Record<string, number> = {
  deepseek: 8192, groq: 8192, moonshot: 8192, zhipu: 4096,
};

// ============ Mode Tool Whitelist ============
export const DEFAULT_MODE_TOOLS: Record<string, string[]> = {
  coding: ['createFile', 'editFile', 'deleteFile', 'readFile', 'runCommand', 'deploy', 'run_tests', 'searchWeb', 'smart_search', 'read_url', 'analyze_image', 'saveMemory', 'delegate_task', 'plan_and_execute', 'aggregate_results', 'generate_chart', 'generate_ppt', 'generate_document', 'generate_excel', 'schedule_task', 'think_and_plan', 'update_progress', 'reflect_and_schedule', 'execute_code', 'create_dynamic_tool', 'call_dynamic_tool', 'list_dynamic_tools', 'browser_navigate', 'browser_click', 'browser_fill', 'browser_extract', 'browser_screenshot', 'browser_execute_js', 'save_cross_memory', 'search_cross_memory', 'list_cross_memories', 'delete_cross_memory', 'reflect_and_improve', 'memory_maintenance', 'save_learned_skill'],
  writing: ['searchWeb', 'smart_search', 'read_url', 'analyze_image', 'saveMemory', 'delegate_task', 'plan_and_execute', 'aggregate_results', 'generate_chart', 'generate_ppt', 'generate_document', 'generate_excel', 'schedule_task', 'think_and_plan', 'update_progress', 'reflect_and_schedule', 'execute_code', 'create_dynamic_tool', 'call_dynamic_tool', 'list_dynamic_tools', 'browser_navigate', 'browser_click', 'browser_fill', 'browser_extract', 'browser_screenshot', 'browser_execute_js', 'save_cross_memory', 'search_cross_memory', 'list_cross_memories', 'delete_cross_memory'],
  analysis: ['searchWeb', 'smart_search', 'read_url', 'analyze_image', 'saveMemory', 'delegate_task', 'plan_and_execute', 'aggregate_results', 'generate_chart', 'generate_ppt', 'generate_document', 'generate_excel', 'schedule_task', 'think_and_plan', 'update_progress', 'reflect_and_schedule', 'execute_code', 'create_dynamic_tool', 'call_dynamic_tool', 'list_dynamic_tools', 'browser_navigate', 'browser_extract', 'browser_screenshot', 'save_cross_memory', 'search_cross_memory'],
  design: ['smart_search', 'read_url', 'analyze_image', 'saveMemory'],
  chat: ['searchWeb', 'smart_search', 'read_url', 'analyze_image', 'saveMemory', 'delegate_task', 'plan_and_execute', 'aggregate_results', 'generate_chart', 'generate_ppt', 'generate_document', 'generate_excel', 'schedule_task', 'think_and_plan', 'update_progress', 'reflect_and_schedule', 'execute_code', 'create_dynamic_tool', 'call_dynamic_tool', 'list_dynamic_tools', 'browser_navigate', 'browser_click', 'browser_fill', 'browser_extract', 'browser_screenshot', 'browser_execute_js', 'reflect_and_improve', 'memory_maintenance', 'save_learned_skill'],
};

// ============ Tool Chinese Name Mapping ============
export const DEFAULT_TOOL_NAME_ZH: Record<string, string> = {
  createFile: '\u521b\u5efa\u6587\u4ef6', editFile: '\u4fee\u6539\u6587\u4ef6', deleteFile: '\u5220\u9664\u6587\u4ef6',
  readFile: '\u8bfb\u53d6\u6587\u4ef6', runCommand: '\u6267\u884c\u547d\u4ee4', deploy: '\u90e8\u7f72\u9879\u76ee',
  searchWeb: '\u8054\u7f51\u641c\u7d22', saveMemory: '\u4fdd\u5b58\u8bb0\u5fc6',
  run_evaluation: '\u8bc4\u4f30\u8d28\u91cf', run_optimization: '\u4f18\u5316\u4ee3\u7801',
  run_code_review: '\u4ee3\u7801\u5ba1\u67e5', run_refactor: '\u91cd\u6784\u4ee3\u7801',
  delegate_task: '\u59d4\u6d3e\u5b50\u667a\u80fd\u4f53', plan_and_execute: '\u89c4\u5212\u5e76\u6267\u884c\u591a\u4efb\u52a1',
  aggregate_results: '\u6c47\u603b\u5b50\u667a\u80fd\u4f53\u7ed3\u679c', generate_chart: '\u751f\u6210\u56fe\u8868',
  generate_ppt: '\u751f\u6210PPT', generate_document: '\u751f\u6210\u6587\u6863',
  generate_excel: '\u751f\u6210Excel',
  schedule_task: '\u521b\u5efa\u5b9a\u65f6\u4efb\u52a1', think_and_plan: '\u89c4\u5212\u4efb\u52a1\u6b65\u9aa4',
  update_progress: '\u66f4\u65b0\u6267\u884c\u8fdb\u5ea6', reflect_and_schedule: '\u53cd\u601d\u4e0e\u8c03\u5ea6',
  smart_search: '\u667a\u80fd\u641c\u7d22', read_url: '\u8bfb\u53d6\u7f51\u9875',
  analyze_image: '\u56fe\u7247\u7406\u89e3', execute_code: '\u6267\u884c\u4ee3\u7801',
  create_dynamic_tool: '\u521b\u5efa\u52a8\u6001\u5de5\u5177', call_dynamic_tool: '\u8c03\u7528\u52a8\u6001\u5de5\u5177',
  list_dynamic_tools: '\u5217\u51fa\u52a8\u6001\u5de5\u5177',
  browser_navigate: '\u6d4f\u89c8\u5668\u6253\u5f00\u7f51\u9875', browser_click: '\u6d4f\u89c8\u5668\u70b9\u51fb',
  browser_fill: '\u6d4f\u89c8\u5668\u586b\u5199', browser_extract: '\u6d4f\u89c8\u5668\u63d0\u53d6\u6570\u636e',
  browser_screenshot: '\u6d4f\u89c8\u5668\u622a\u56fe', browser_execute_js: '\u6d4f\u89c8\u5668\u6267\u884cJS',
  save_cross_memory: '\u4fdd\u5b58\u8de8\u5bf9\u8bdd\u8bb0\u5fc6', search_cross_memory: '\u641c\u7d22\u8de8\u5bf9\u8bdd\u8bb0\u5fc6',
  list_cross_memories: '\u5217\u51fa\u8de8\u5bf9\u8bdd\u8bb0\u5fc6', delete_cross_memory: '\u5220\u9664\u8de8\u5bf9\u8bdd\u8bb0\u5fc6',
  generate_image: '\u751f\u6210\u56fe\u7247', verify_operation: '\u9a8c\u8bc1\u64cd\u4f5c',
  send_message_to_subagent: '\u53d1\u9001\u6d88\u606f\u7ed9\u5b50\u667a\u80fd\u4f53',
  health_check: '\u5065\u5eb7\u68c0\u67e5', ssh_execute: '\u6267\u884c\u547d\u4ee4',
  ssh_read_file: '\u8bfb\u53d6\u6587\u4ef6', ssh_write_file: '\u5199\u5165\u6587\u4ef6',
  build_project: '\u6784\u5efa\u9879\u76ee', deploy_service: '\u90e8\u7f72\u670d\u52a1',
  git_commit: '\u63d0\u4ea4\u4ee3\u7801', web_scrape: '\u7f51\u9875\u6293\u53d6',
  web_search: '\u7f51\u9875\u641c\u7d22', diagnose_error: '\u9519\u8bef\u8bca\u65ad',
  read_skill_file: '\u8bfb\u53d6\u6280\u80fd', get_available_skills: '\u53ef\u7528\u6280\u80fd',
  activate_skill: '\u6fc0\u6d3b\u6280\u80fd', reflect_and_improve: '\u53cd\u601d\u6539\u8fdb',
  save_learned_skill: '\u4fdd\u5b58\u5b66\u4e60\u6280\u80fd',
};

// ============ Model Identity Mapping ============
export const DEFAULT_MODEL_IDENTITY: Record<string, string> = {
  deepseek: 'DeepSeek \u6df1\u5ea6\u6c42\u7d22',
  zhipu: '\u667a\u8c31AI (GLM)',
  qwen: '\u901a\u4e49\u5343\u95ee (Qwen)',
  openai: 'OpenAI (GPT)',
  'openai-image': 'OpenAI (GPT Image)',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  moonshot: 'Kimi \u6708\u4e4b\u6697\u9762',
  doubao: '\u8c46\u5305 (Doubao)',
  groq: 'Groq (Llama)',
  banana: 'Banana',
  agnes: 'Agnes AI',
  'agnes-image': 'Agnes Image',
  minimax: 'MiniMax',
  yi: '\u96f6\u4e00\u4e07\u7269',
  baidu: '\u767e\u5ea6\u5343\u5e06',
  spark: '\u8baf\u98de\u661f\u706b',
  meta: 'Meta (Llama)',
  mistral: 'Mistral',
  cohere: 'Cohere',
};

// ============ Patrol Config Defaults ============
export const DEFAULT_PATROL_CONFIG = {
  token: 'patrol-2026-secure',
};

// ============ Helper: Load config from DB with fallback ============
export async function loadProviderUrls(getSetting: (key: string) => Promise<string | null>): Promise<Record<string, string>> {
  try {
    const raw = await getSetting('provider_urls');
    if (raw) return { ...DEFAULT_PROVIDER_URLS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PROVIDER_URLS };
}

export async function loadRuntimeConfig(getSetting: (key: string) => Promise<string | null>): Promise<typeof DEFAULT_RUNTIME_CONFIG> {
  try {
    const raw = await getSetting('advanced_config');
    if (raw) {
      const adv = JSON.parse(raw);
      return { ...DEFAULT_RUNTIME_CONFIG, ...adv };
    }
  } catch {}
  return { ...DEFAULT_RUNTIME_CONFIG };
}

export async function loadModeTools(getSetting: (key: string) => Promise<string | null>): Promise<Record<string, string[]>> {
  try {
    const raw = await getSetting('mode_tool_whitelist');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...DEFAULT_MODE_TOOLS };
}

export async function loadModelIdentity(getSetting: (key: string) => Promise<string | null>): Promise<Record<string, string>> {
  try {
    const raw = await getSetting('model_identity');
    if (raw) return { ...DEFAULT_MODEL_IDENTITY, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_MODEL_IDENTITY };
}

export async function loadToolNameZh(getSetting: (key: string) => Promise<string | null>): Promise<Record<string, string>> {
  try {
    const raw = await getSetting('tool_name_zh');
    if (raw) return { ...DEFAULT_TOOL_NAME_ZH, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_TOOL_NAME_ZH };
}

export async function loadPatrolConfig(getSetting: (key: string) => Promise<string | null>): Promise<typeof DEFAULT_PATROL_CONFIG> {
  try {
    const raw = await getSetting('patrol_config');
    if (raw) return { ...DEFAULT_PATROL_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PATROL_CONFIG };
}

export async function loadToolSafetyTiers(getSetting: (key: string) => Promise<string | null>): Promise<Record<string, { tier: string; description: string }>> {
  try {
    const raw = await getSetting('tool_safety_tiers');
    if (raw) return { ...DEFAULT_TOOL_SAFETY_TIERS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_TOOL_SAFETY_TIERS };
}

export async function loadSshSafeCommands(getSetting: (key: string) => Promise<string | null>): Promise<string[]> {
  try {
    const raw = await getSetting('ssh_safe_commands');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [...DEFAULT_SSH_SAFE_COMMANDS];
}

// ============ P2: Notification Config Defaults ============
export const DEFAULT_NOTIFICATION_CONFIG = {
  enabled: false,
  webhooks: [
    { type: 'dingtalk', url: '', secret: '', enabled: false, label: '钉钉群' },
    { type: 'feishu', url: '', secret: '', enabled: false, label: '飞书群' },
    { type: 'wechat', url: '', secret: '', enabled: false, label: '企业微信' },
    { type: 'custom', url: '', secret: '', enabled: false, label: '自定义Webhook' },
  ],
};

export async function loadNotificationConfig(getSetting: (key: string) => Promise<string | null>) {
  try {
    const raw = await getSetting('notification_config');
    if (raw) return { ...DEFAULT_NOTIFICATION_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_NOTIFICATION_CONFIG };
}

