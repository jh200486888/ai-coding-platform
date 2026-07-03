'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Save, RotateCcw } from 'lucide-react';

interface ToolTier {
  tier: string;
  description: string;
}

interface ToolEntry {
  name: string;
  tier: string;
  description: string;
}

const TIER_CONFIG = [
  { key: 'safe', label: '安全 (自动放行)', icon: ShieldCheck, color: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800' },
  { key: 'guarded', label: '受控 (需审批)', icon: ShieldAlert, color: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/30 dark:border-yellow-800' },
  { key: 'blocked', label: '禁用 (拦截)', icon: ShieldX, color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800' },
];

const SAFE_TIER_TOOLS: Record<string, ToolTier> = {
  ssh_read_file: { tier: 'safe', description: '只读文件操作' },
  health_check: { tier: 'safe', description: '健康检查' },
  diagnose_error: { tier: 'safe', description: '错误诊断' },
  smart_search: { tier: 'safe', description: '智能搜索' },
  read_url: { tier: 'safe', description: '读取网页' },
  analyze_image: { tier: 'safe', description: '图片分析' },
  web_scrape: { tier: 'safe', description: '网页抓取' },
  web_search: { tier: 'safe', description: '联网搜索' },
  execute_code: { tier: 'safe', description: '代码执行(沙箱)' },
  browser_navigate: { tier: 'safe', description: '浏览器导航' },
  browser_click: { tier: 'safe', description: '浏览器点击' },
  browser_fill: { tier: 'safe', description: '浏览器填写' },
  browser_extract: { tier: 'safe', description: '浏览器提取' },
  browser_screenshot: { tier: 'safe', description: '浏览器截图' },
  browser_execute_js: { tier: 'safe', description: '浏览器执行JS' },
  preview_html: { tier: 'safe', description: 'HTML预览' },
  get_available_skills: { tier: 'safe', description: '获取技能列表' },
  activate_skill: { tier: 'safe', description: '激活技能' },
  read_skill_file: { tier: 'safe', description: '读取技能文件' },
  reflect_and_improve: { tier: 'safe', description: '反思改进' },
  memory_maintenance: { tier: 'safe', description: '记忆维护' },
  save_cross_memory: { tier: 'safe', description: '保存跨会话记忆' },
  search_cross_memory: { tier: 'safe', description: '搜索跨会话记忆' },
  list_cross_memories: { tier: 'safe', description: '列出跨会话记忆' },
  create_dynamic_tool: { tier: 'safe', description: '创建动态工具' },
  call_dynamic_tool: { tier: 'safe', description: '调用动态工具' },
  list_dynamic_tools: { tier: 'safe', description: '列出动态工具' },
  db_list_tables: { tier: 'safe', description: '列出数据库表' },
  db_describe_table: { tier: 'safe', description: '描述表结构' },
  db_query: { tier: 'safe', description: '数据库查询' },
  db_table_data: { tier: 'safe', description: '查看表数据' },
  github_search_code: { tier: 'safe', description: 'GitHub代码搜索' },
  github_list_issues: { tier: 'safe', description: '列出Issues' },
  github_list_prs: { tier: 'safe', description: '列出PR' },
  github_get_repo: { tier: 'safe', description: '获取仓库信息' },
  ssh_execute: { tier: 'guarded', description: 'SSH命令执行(动态:读自动放行)' },
  ssh_write_file: { tier: 'guarded', description: '写入/修改文件' },
  build_project: { tier: 'guarded', description: '构建项目' },
  deploy_service: { tier: 'guarded', description: '部署服务' },
  git_commit: { tier: 'guarded', description: 'Git提交代码' },
  delete_cross_memory: { tier: 'guarded', description: '删除跨会话记忆' },
  github_create_issue: { tier: 'guarded', description: '创建Issue' },
};

export default function ToolSafetyPanel() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('safe');
  const [searchTerm, setSearchTerm] = useState('');

  const loadTiers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-config?key=tool_safety_tiers');
      const data = await res.json();
      let tiers = SAFE_TIER_TOOLS;
      if (data.value) {
        tiers = { ...SAFE_TIER_TOOLS, ...JSON.parse(data.value) };
      } else if (data.data?.tool_safety_tiers) {
        tiers = { ...SAFE_TIER_TOOLS, ...data.data.tool_safety_tiers };
      }
      const entries = Object.entries(tiers).map(([name, v]) => ({ name, ...v } as ToolEntry));
      setTools(entries);
    } catch {
      const entries = Object.entries(SAFE_TIER_TOOLS).map(([name, v]) => ({ name, ...v } as ToolEntry));
      setTools(entries);
    }
  }, []);

  useEffect(() => { loadTiers(); }, [loadTiers]);

  const handleTierChange = (toolName: string, newTier: string) => {
    setTools(prev => prev.map(t => t.name === toolName ? { ...t, tier: newTier } : t));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tierMap: Record<string, ToolTier> = {};
      tools.forEach(t => { tierMap[t.name] = { tier: t.tier, description: t.description }; });
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'tool_safety_tiers', value: JSON.stringify(tierMap) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage('保存失败: ' + (err.error || 'HTTP ' + res.status));
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      setDirty(false);
      setMessage('✅ 已保存');
      setTimeout(() => setMessage(''), 2000);
    } catch (e: any) {
      setMessage('保存失败: ' + (e.message || '网络错误'));
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定恢复为默认配置？')) return;
    await fetch('/api/admin/platform-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'tool_safety_tiers', value: JSON.stringify(SAFE_TIER_TOOLS) }),
    });
    loadTiers();
    setDirty(false);
    setMessage('已恢复默认');
    setTimeout(() => setMessage(''), 2000);
  };

  const filtered = tools.filter(t => {
    const matchTier = activeTab === 'all' || t.tier === activeTab;
    const matchSearch = !searchTerm || t.name.includes(searchTerm) || t.description.includes(searchTerm);
    return matchTier && matchSearch;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Shield size={16} /> 工具安全分级管理
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            三级安全策略：安全(自动放行) / 受控(需用户审批) / 禁用(完全拦截)。修改后实时生效。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-green-600">{message}</span>}
          {dirty && <span className="text-xs text-orange-500">● 未保存</span>}
          <button onClick={handleReset} className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted">
            <RotateCcw size={12} className="inline mr-1" />恢复默认
          </button>
          <button onClick={handleSave} disabled={!dirty || saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            <Save size={12} className="inline mr-1" />保存
          </button>
        </div>
      </div>

      {/* Tab filters */}
      <div className="flex items-center gap-2">
        {['all', 'safe', 'guarded', 'blocked'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {tab === 'all' ? `全部 (${tools.length})` :
             tab === 'safe' ? `安全 (${tools.filter(t => t.tier === 'safe').length})` :
             tab === 'guarded' ? `受控 (${tools.filter(t => t.tier === 'guarded').length})` :
             `禁用 (${tools.filter(t => t.tier === 'blocked').length})`}
          </button>
        ))}
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索工具名或描述..."
          className="ml-auto text-xs px-3 py-1.5 border rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tool list */}
      <div className="border rounded-lg divide-y">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">无匹配工具</div>
        ) : (
          filtered.map(tool => (
            <div key={tool.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
              <span className="font-mono text-xs text-foreground w-48 shrink-0 truncate" title={tool.name}>{tool.name}</span>
              <span className="text-xs text-muted-foreground flex-1 truncate">{tool.description}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {TIER_CONFIG.map(tc => (
                  <button
                    key={tc.key}
                    onClick={() => handleTierChange(tool.name, tc.key)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all ${tool.tier === tc.key ? tc.color + ' font-medium ring-1 ring-current' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {tc.key === 'safe' ? '安全' : tc.key === 'guarded' ? '受控' : '禁用'}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
