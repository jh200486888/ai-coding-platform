'use client';
import { toast } from 'sonner';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Key, Settings, MessageSquare, Plus, Trash2, Save, RefreshCw, Upload, Folder, File, Eye, Lock, Palette, Activity, Plug, Brain, BookOpen, LayoutDashboard, ChevronDown, ChevronRight, Clock, Database, CheckCircle2, XCircle, Cpu, BarChart3, Shield, Paintbrush, Heart, Users, Zap, Edit2, X} from 'lucide-react';
import { ImageGenPanel } from "@/components/admin/ImageGenPanel";
import { TelemetryPanel } from "@/components/admin/TelemetryPanel";
import { McpServersPanel } from "@/components/admin/McpServersPanel";
import { MemoryPanel } from "@/components/admin/MemoryPanel";
import { KnowledgePanel } from "@/components/admin/KnowledgePanel";
import { ScheduledTasksPanel } from "@/components/admin/ScheduledTasksPanel";
import { PatrolPanel } from '@/components/admin/PatrolPanel';
import { HeartbeatPanel } from '@/components/admin/HeartbeatPanel';
import { DesignConfigPanel } from '@/components/admin/DesignConfigPanel';
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import type { ModelConfig, ApiKey, Conversation } from '@/lib/types';

// 模型数据从 models.ts 导入（单一数据源，避免多处维护）
import { MODELS as MODELS_IMPORT } from '@/lib/models';
const MODELS_DATA = MODELS_IMPORT.map(m => ({ id: m.id, name: m.name, provider: m.provider, description: m.description || '' }));

type Tab = 'dashboard' | 'keys' | 'models' | 'conversations' | 'settings' | 'settings-advanced' | 'oauth' | 'projects' | 'account' | 'telemetry' | 'mcp' | 'memory' | 'knowledge' | 'tasks' | 'patrol' | 'heartbeat' | 'design' | 'sub-agents' | 'skills';

// ============ Sidebar Navigation Structure ============
interface SidebarGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: { id: Tab; label: string; icon?: React.ReactNode }[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: 'dashboard',
    label: '仪表盘',
    icon: <LayoutDashboard size={16} />,
    items: [{ id: 'dashboard', label: '仪表盘' }],
  },
  {
    id: 'ai',
    label: 'AI 配置',
    icon: <Cpu size={16} />,
    items: [
      { id: 'models', label: '模型管理', icon: <Settings size={14} /> },
      { id: 'keys', label: 'API密钥', icon: <Key size={14} /> },
      { id: 'mcp', label: 'MCP服务器', icon: <Plug size={14} /> },
    ],
  },
  {
    id: 'system',
    label: '系统',
    icon: <Settings size={16} />,
    items: [
      { id: 'settings', label: '基本设置' },
      { id: 'settings-advanced', label: '高级参数' },
      { id: 'oauth', label: '第三方登录' },
    ],
  },
  {
    id: 'data',
    label: '数据',
    icon: <Database size={16} />,
    items: [
      { id: 'conversations', label: '对话记录', icon: <MessageSquare size={14} /> },
      { id: 'memory', label: '记忆管理', icon: <Brain size={14} /> },
      { id: 'knowledge', label: '知识库', icon: <BookOpen size={14} /> },
      { id: 'skills', label: '技能管理', icon: <Zap size={14} /> },
      { id: 'projects', label: '项目管理', icon: <Folder size={14} /> },
      { id: 'tasks', label: '定时任务', icon: <Clock size={14} /> },
      { id: 'sub-agents', label: '子智能体', icon: <Users size={14} /> },
      { id: 'design', label: '设计 & 生图', icon: <Paintbrush size={14} /> },
    ],
  },
  {
    id: 'monitor',
    label: '监控',
    icon: <BarChart3 size={16} />,
    items: [
      { id: 'telemetry', label: 'AI监控', icon: <Activity size={14} /> },
      { id: 'patrol', label: '系统巡检', icon: <Shield size={14} /> },
      { id: 'heartbeat', label: '心跳巡检', icon: <Heart size={14} /> },
    ],
  },
  {
    id: 'account',
    label: '账号',
    icon: <Lock size={16} />,
    items: [{ id: 'account', label: '账号设置' }],
  },
];

export default function AdminPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check admin session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/login');
        const data = await res.json();
        if (!data.authenticated) {
          window.location.href = '/admin/login';
          return;
        }
      } catch {
        window.location.href = '/admin/login';
        return;
      }
      setAuthChecked(true);
    })();
  }, []);

  // Global 401 interceptor: override fetch for admin API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (url.startsWith('/api/admin/')) {
        return originalFetch(...args).then(res => {
          if (res.status === 401) {
            window.location.href = '/admin/login';
          }
          return res;
        });
      }
      return originalFetch(...args);
    };
    

return () => { window.fetch = originalFetch; };
  }, []);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const activeGroup = SIDEBAR_GROUPS.find(g => g.items.some(i => i.id === activeTab))?.id || 'dashboard';

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground">验证中...</div></div>;
  }

  

    return (
    <div className="min-h-screen bg-background flex relative">
      <style>{`
  @media (max-width: 768px) {
    .admin-sidebar {
      position: fixed !important;
      left: -100% !important;
      top: 0;
      bottom: 0;
      z-index: 50;
      transition: left 0.3s ease;
      width: 75vw !important;
      min-width: 0 !important;
      max-width: 280px !important;
      flex: none !important;
      box-shadow: 4px 0 20px rgba(0,0,0,0.5);
    }
    .admin-sidebar.open {
      left: 0 !important;
    }
    .admin-overlay {
      display: block !important;
    }
    .admin-main {
      width: 100vw !important;
      max-width: 100vw !important;
      margin-left: 0 !important;
      padding: 12px 8px !important;
      padding-top: 56px !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
    }
    .admin-mobile-header {
      display: flex !important;
    }
    .admin-main .bg-card {
      padding: 12px !important;
    }
    .admin-main h2 {
      font-size: 16px !important;
    }
    .admin-main h3 {
      font-size: 14px !important;
    }
    .admin-main .space-y-6 > * + * {
      margin-top: 12px !important;
    }
    .admin-main textarea {
      font-size: 14px !important;
    }
    .admin-main input[type="text"],
    .admin-main input[type="password"],
    .admin-main input[type="number"],
    .admin-main select {
      font-size: 16px !important;
    }
  }
  @media (min-width: 769px) {
    .admin-mobile-header {
      display: none !important;
    }
    .admin-overlay {
      display: none !important;
    }
  }
`}</style>
      {/* Mobile hamburger button */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="admin-mobile-header fixed top-0 left-0 z-50 p-3 bg-card border-b border-border rounded-br-lg shadow-lg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      {/* Mobile overlay */}
      {sidebarOpen && <div className="admin-overlay fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />}
      {/* Left Sidebar */}
      <aside className={`admin-sidebar md:w-[220px] md:min-w-[220px] md:shrink-0 md:relative w-[75vw] max-w-[280px] h-screen bg-card border-r border-border flex flex-col ${sidebarOpen ? 'open' : ''}`}>
        <div className="px-4 py-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
            <ArrowLeft size={14} /> 返回首页
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-lg font-bold">后台管理</h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {SIDEBAR_GROUPS.map(group => {
            const isSingle = group.id === 'dashboard' || group.id === 'account';
            const isCollapsed = collapsedGroups.has(group.id);
            const isGroupActive = activeGroup === group.id;

            if (isSingle) {
              const item = group.items[0];
              const isActive = activeTab === item.id;
              return (
                <div key={group.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r" />}
                    {group.icon}
                    {group.label}
                  </button>
                  {group.id === 'dashboard' && <div className="my-2 border-t border-border" />}
                </div>
              );
            }

            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isGroupActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2">{group.icon}{group.label}</span>
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                {!isCollapsed && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors relative ${
                            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r" />}
                          {item.icon}{item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-border">
          <button
            onClick={async () => { await fetch('/api/admin/login', { method: 'DELETE' }); window.location.href = '/admin/login'; }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="admin-main flex-1 min-h-screen overflow-y-auto p-4 md:p-6">
        {/* Mobile active tab indicator */}
        <div className="md:hidden text-sm text-muted-foreground mb-3 -mt-1">
          {SIDEBAR_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || '仪表盘'}
        </div>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-6">
          {activeTab === 'dashboard' && <DashboardPanel />}
          {activeTab === 'keys' && <ApiKeysPanel />}
          {activeTab === 'models' && <ModelsPanel />}
          {activeTab === 'conversations' && <ConversationsPanel />}
          {activeTab === 'settings' && <SettingsPanel initialSubTab="basic" />}
          {activeTab === 'settings-advanced' && <SettingsPanel initialSubTab="advanced" />}
          {activeTab === 'oauth' && <AuthSettingsPanel />}
          {activeTab === 'projects' && <ProjectsPanel />}
          {activeTab === 'account' && <AccountPanel />}

          {activeTab === 'telemetry' && <TelemetryPanel />}
          {activeTab === 'patrol' && <PatrolPanel />}
          {activeTab === 'heartbeat' && <HeartbeatPanel />}
              {activeTab === 'design' && (
                <div className="space-y-6">
                  <DesignConfigPanel />
                  <div className="border-t border-border pt-6">
                    <ImageGenPanel />
                  </div>
                </div>
              )}
          {activeTab === 'mcp' && <McpServersPanel />}
          {activeTab === 'memory' && <MemoryPanel />}
          {activeTab === 'knowledge' && <KnowledgePanel />}
          {activeTab === 'tasks' && <ScheduledTasksPanel />}
          {activeTab === 'skills' && <SkillsPanel />}
          {activeTab === 'sub-agents' && <SubAgentsPanel />}
        </div>
      </main>
    </div>
  );
}

// ============ Dashboard Panel ============

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString();
}

function DashboardPanel() {
  const [stats, setStats] = useState<{
    totalConversations: number;
    todayConversations: number;
    todayMessages: number;
    activeModels: number;
    apiSuccessRate: number;
    recentConversations: { id: string; title: string; modelId: string; userId: string; createdAt: string; updatedAt: string; msg_count: number }[];
    dbHealthy: boolean;
    activeApiKeys: number;
    todayTokens: { prompt: number; completion: number; total: number };
    totalTokens: { prompt: number; completion: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (data.success && data.data) setStats(data.data);
    } catch (err) { console.error('Failed to fetch dashboard:', err); }
    finally { setLoading(false); }
  };

  const fmtK = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n);
  const statCards = stats ? [
    { label: '总对话数', value: stats.totalConversations, icon: <MessageSquare size={20} />, color: 'text-blue-400' },
    { label: '今日对话数', value: stats.todayConversations, icon: <MessageSquare size={20} />, color: 'text-green-400' },
    { label: '今日消息数', value: stats.todayMessages, icon: <BarChart3 size={20} />, color: 'text-emerald-400' },
    { label: '活跃模型数', value: stats.activeModels, icon: <Cpu size={20} />, color: 'text-purple-400' },
    { label: 'API成功率', value: `${stats.apiSuccessRate}%`, icon: <Activity size={20} />, color: stats.apiSuccessRate >= 95 ? 'text-green-400' : 'text-yellow-400' },
    { label: '今日Token消耗', value: fmtK(stats.todayTokens?.total || 0), sub: `输入 ${fmtK(stats.todayTokens?.prompt || 0)} / 输出 ${fmtK(stats.todayTokens?.completion || 0)}`, icon: <Zap size={20} />, color: 'text-amber-400' },
    { label: '累计Token消耗', value: fmtK(stats.totalTokens?.total || 0), sub: `输入 ${fmtK(stats.totalTokens?.prompt || 0)} / 输出 ${fmtK(stats.totalTokens?.completion || 0)}`, icon: <Zap size={20} />, color: 'text-orange-400' },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">仪表盘</h2>
        <button onClick={fetchDashboard} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent">
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">加载中...</div>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {statCards.map((card, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <span className={card.color}>{card.icon}</span>
                </div>
                <div className="text-2xl font-bold">{card.value}</div>
                {'sub' in card && card.sub && <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>}
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-medium mb-3">系统状态</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {stats.dbHealthy ? (
                  <><CheckCircle2 size={16} className="text-green-400" /><span className="text-sm">数据库连接正常</span></>
                ) : (
                  <><XCircle size={16} className="text-red-400" /><span className="text-sm">数据库连接异常</span></>
                )}
              </div>
              <div className="flex items-center gap-2">
                {stats.activeApiKeys > 0 ? (
                  <><CheckCircle2 size={16} className="text-green-400" /><span className="text-sm">{stats.activeApiKeys} 个API密钥可用</span></>
                ) : (
                  <><XCircle size={16} className="text-yellow-400" /><span className="text-sm">未配置API密钥</span></>
                )}
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-medium mb-3">最近对话</h3>
            {stats.recentConversations.length > 0 ? (
              <div className="space-y-2">
                {stats.recentConversations.map((conv) => (
                  <div key={conv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                    <div>
                      <span className="text-sm font-medium truncate block">{conv.title}</span>
                      <span className="text-xs text-muted-foreground">{conv.modelId} · {conv.msg_count || 0}条消息 · {timeAgo(conv.updatedAt || conv.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无对话记录</p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-12">加载失败，请刷新重试</div>
      )}
    </div>
  );
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o / GPT-4 / GPT-3.5' },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude 4 / Claude 3.5' },
  { id: 'google', name: 'Google', desc: 'Gemini 2.5 / Gemini 2.0' },
  { id: 'deepseek', name: 'DeepSeek 深度求索', desc: 'DeepSeek V3 / R1' },
  { id: 'zhipu', name: '智谱 AI', desc: 'GLM-5 / GLM-4' },
  { id: 'qwen', name: '通义千问', desc: 'Qwen 3.5 / Qwen Max' },
  { id: 'doubao', name: '豆包', desc: 'Doubao Seed 2.0' },
  { id: 'kimi', name: 'Kimi 月之暗面', desc: 'Kimi K2.5' },
  { id: 'baidu', name: '文心一言', desc: 'ERNIE 4.5 / 4.0' },
  { id: 'spark', name: '讯飞星火', desc: 'Spark 4.0' },
  { id: 'minimax', name: 'MiniMax', desc: 'M2.5 / M2.7' },
  { id: 'yi', name: '零一万物', desc: 'Yi-Lightning' },
  { id: 'meta', name: 'Meta', desc: 'Llama 3.3 / 3.1' },
  { id: 'mistral', name: 'Mistral', desc: 'Mistral Large 2' },
  { id: 'cohere', name: 'Cohere', desc: 'Command R+' },
  { id: 'agnes', name: 'Agnes AI', desc: 'Agnes 1.5/2.0 Flash 文本模型' },
  { id: 'agnes-image', name: 'Agnes Image', desc: '图像/视频生成模型' },
  { id: 'tavily', name: 'Tavily', desc: 'AI搜索API（推荐）' },
  { id: 'github', name: 'GitHub', desc: 'GitHub API（代码搜索/Issues/PR）' },
  { id: 'firecrawl', name: 'Firecrawl', desc: '网页抓取/搜索' },
];

function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: '', provider_name: '', api_key: '', base_url: '' });
  const [loading, setLoading] = useState(false);
  const [searchProvider, setSearchProvider] = useState('');
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editForm, setEditForm] = useState({ api_key: '', base_url: '' });

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/admin/keys');
    const data = await res.json();
    if (data.data) setKeys(data.data);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleSubmit = async () => {
    if (!form.provider || !form.provider_name || !form.api_key) return;
    setLoading(true);
    try {
      await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ provider: '', provider_name: '', api_key: '', base_url: '' });
      setShowForm(false);
      await fetchKeys();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此API Key？')) return;
    await fetch(`/api/admin/keys?id=${id}`, { method: 'DELETE' });
    await fetchKeys();
  };

  const handleSelectProvider = (providerId: string) => {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setForm({ ...form, provider: provider.id, provider_name: provider.name });
    }
  };

  const handleEditKey = (key: ApiKey) => {
    setEditingKey(key);
    setEditForm({ api_key: '', base_url: key.base_url || '' });
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;
    const body: any = { id: editingKey.id };
    if (editForm.api_key) body.api_key = editForm.api_key;
    if (editForm.base_url) body.base_url = editForm.base_url;
    await fetch('/api/admin/keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditingKey(null);
    await fetchKeys();
  };

  const filteredProviders = PROVIDERS.filter(p => 
    p.id.toLowerCase().includes(searchProvider.toLowerCase()) ||
    p.name.toLowerCase().includes(searchProvider.toLowerCase()) ||
    p.desc.toLowerCase().includes(searchProvider.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">API 密钥管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          <Plus size={14} /> 添加密钥
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">选择厂商</label>
            <div className="relative">
              <select
                value={form.provider}
                onChange={(e) => handleSelectProvider(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary appearance-none cursor-pointer"
              >
                <option value="">-- 请选择大模型厂商 --</option>
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id}) - {p.desc}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            {form.provider && (
              <div className="text-xs text-muted-foreground">
                已选择: <span className="text-primary font-medium">{form.provider_name}</span> (ID: {form.provider})
              </div>
            )}
          </div>
          <input
            placeholder="API 密钥"
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="API 地址（可选，留空使用默认）"
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !form.provider || !form.api_key}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} /> 保存
          </button>
        </div>
      )}

      {editingKey && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Edit2 size={16} /> 编辑 {editingKey.provider_name}
            </h3>
            <button onClick={() => setEditingKey(null)} className="p-1 hover:bg-accent rounded">
              <X size={16} />
            </button>
          </div>
          <input
            placeholder="API 密钥（留空则不修改）"
            type="password"
            value={editForm.api_key}
            onChange={(e) => setEditForm({ ...editForm, api_key: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="API 地址"
            value={editForm.base_url}
            onChange={(e) => setEditForm({ ...editForm, base_url: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpdateKey}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
            >
              <Save size={14} /> 保存
            </button>
            <button
              onClick={() => setEditingKey(null)}
              className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-card border border-border rounded-xl gap-2">
            <div>
              <div className="font-medium">{key.provider_name}</div>
              <div className="text-sm text-muted-foreground">{key.api_key_encrypted || '未填写密钥'}</div>
              {key.base_url && <div className="text-xs text-muted-foreground mt-1">{key.base_url}</div>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleEditKey(key)}
                className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                title="编辑"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDelete(key.id)}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {keys.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>暂无 API 密钥</p>
            <p className="text-sm mt-2">请点击"添加密钥"配置你的大模型 API</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Models Panel ============
function ModelsPanel() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [form, setForm] = useState({
    model_id: '', display_name: '', provider: 'openai', description: '',
    default_temperature: '0.7', default_max_tokens: 4096, sort_order: 0,
  });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchModels = useCallback(async (showFeedback: boolean = false) => {
    if (showFeedback) setRefreshing(true);
    try {
      const res = await fetch("/api/models");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.data) setModels(data.data);
      if (showFeedback) toast.success("模型列表已刷新");
    } catch (err) {
      console.error("Failed to fetch models:", err);
      if (showFeedback) toast.error("刷新失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      if (showFeedback) setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleSubmit = async () => {
    if (!form.model_id || !form.display_name) return;
    setLoading(true);
    try {
      await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, is_enabled: true }),
      });
      setForm({ model_id: '', display_name: '', provider: 'openai', description: '', default_temperature: '0.7', default_max_tokens: 4096, sort_order: 0 });
      setShowForm(false);
      setEditingModel(null);
      await fetchModels();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (model: ModelConfig) => {
    setEditingModel(model);
    setForm({
      model_id: model.model_id,
      display_name: model.display_name,
      provider: model.provider,
      description: model.description || '',
      default_temperature: model.default_temperature || '0.7',
      default_max_tokens: model.default_max_tokens || 4096,
      sort_order: model.sort_order || 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/models?id=${id}`, { method: 'DELETE' });
    await fetchModels();
  };

  const handleToggleEnabled = async (model: ModelConfig) => {
    await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...model,
        is_enabled: !model.is_enabled,
      }),
    });
    await fetchModels();
  };

  const handleUpdateSort = async (model: ModelConfig, newSort: number) => {
    await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...model,
        sort_order: newSort,
      }),
    });
    await fetchModels();
  };

  // 批量导入模型
  const handleBatchImport = async () => {
    if (models.length > 0) {
      const confirmed = confirm(`数据库中已有 ${models.length} 个模型，继续导入将添加重复模型。是否继续？`);
      if (!confirmed) return;
    }
    
    setImporting(true);
    try {
      for (let i = 0; i < MODELS_DATA.length; i++) {
        const m = MODELS_DATA[i];
        await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_id: m.id,
            display_name: m.name,
            provider: m.provider,
            description: m.description,
            is_enabled: true,
            sort_order: i + 1,
          }),
        });
      }
      await fetchModels();
      toast.success(`成功导入 ${MODELS_DATA.length} 个模型！`);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">模型配置</h2>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => fetchModels(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-border text-xs sm:text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "刷新中..." : "刷新"}
          </button>
          <button
            onClick={handleBatchImport}
            disabled={importing}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-600 text-white text-xs sm:text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Upload size={13} /> {importing ? '导入中...' : '导入'}
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditingModel(null); setForm({ model_id: '', display_name: '', provider: 'openai', description: '', default_temperature: '0.7', default_max_tokens: 4096, sort_order: 0 }); }}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm hover:bg-primary/90"
          >
            <Plus size={13} /> 添加
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="模型ID（如 gpt-4o）"
              value={form.model_id}
              onChange={(e) => setForm({ ...form, model_id: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="显示名称（如 GPT-4o）"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              placeholder="厂商（如 openai）"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="Temperature"
              type="number"
              step="0.1"
              value={form.default_temperature}
              onChange={(e) => setForm({ ...form, default_temperature: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="最大Token数"
              type="number"
              value={form.default_max_tokens}
              onChange={(e) => setForm({ ...form, default_max_tokens: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="排序号"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
          </div>
          <input
            placeholder="模型描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={14} /> {editingModel ? '更新' : '保存'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingModel(null); }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {models.map((model) => (
          <div key={model.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-card border border-border rounded-xl gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={model.sort_order || 0}
                  onChange={(e) => handleUpdateSort(model, Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded bg-muted text-xs text-center border border-border"
                />
                <span className="font-medium">{model.display_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{model.provider}</span>
                {model.is_enabled ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">已启用</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">已禁用</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{model.model_id}</div>
              {model.description && <div className="text-xs text-muted-foreground mt-1">{model.description}</div>}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center">
              <button
                onClick={() => handleEdit(model)}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
              >
                编辑
              </button>
              <button
                onClick={() => handleToggleEnabled(model)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${model.is_enabled ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
              >
                {model.is_enabled ? '禁用' : '启用'}
              </button>
              <button
                onClick={() => handleDelete(model.id)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Conversations Panel ============
function ConversationsPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [convRefreshing, setConvRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterDays, setFilterDays] = useState<number>(0); // 0 = all
  const [batchDeleting, setBatchDeleting] = useState(false);

  const fetchConversations = useCallback(async (showFeedback: boolean = false) => {
    if (showFeedback) setConvRefreshing(true);
    try {
      const res = await fetch("/api/admin/conversations");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const convs = Array.isArray(data) ? data : (data.data || []);
      setConversations(convs);
      if (showFeedback) toast.success("对话记录已刷新");
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      if (showFeedback) toast.error("刷新失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      if (showFeedback) setConvRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Filter and sort
  const filteredConversations = conversations
    .filter(c => {
      if (filterDays === 0) return true;
      const d = new Date(c.updated_at || c.created_at);
      const now = new Date();
      return (now.getTime() - d.getTime()) < filterDays * 86400000;
    })
    .sort((a, b) => {
      const da = new Date(a.updated_at || a.created_at).getTime();
      const db = new Date(b.updated_at || b.created_at).getTime();
      return sortOrder === 'newest' ? db - da : da - db;
    });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
      setSelectAll(true);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除 ${selectedIds.size} 条对话记录吗？此操作不可恢复！`)) return;
    setBatchDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => fetch(`/api/conversations/${id}`, { method: 'DELETE' })));
      setSelectedIds(new Set());
      setSelectAll(false);
      await fetchConversations();
      toast.success(`已删除 ${ids.length} 条对话`);
    } catch (err) {
      toast.error("批量删除失败");
    } finally {
      setBatchDeleting(false);
    }
  };

  const loadMessages = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (data.data) setMessages(data.data.messages || []);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    await fetchConversations();
    if (expandedId === id) {
      setExpandedId(null);
      setMessages([]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">对话记录</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg border border-border bg-card text-sm"
          >
            <option value={0}>全部时间</option>
            <option value={1}>最近1天</option>
            <option value={7}>最近7天</option>
            <option value={30}>最近30天</option>
            <option value={90}>最近90天</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="px-2 py-1.5 rounded-lg border border-border bg-card text-sm"
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
          </select>
          <button
            onClick={() => fetchConversations(true)}
            disabled={convRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={14} className={convRefreshing ? "animate-spin" : ""} /> {convRefreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <span className="text-sm font-medium">已选 {selectedIds.size} 条</span>
          <button
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
          >
            <Trash2 size={14} /> {batchDeleting ? "删除中..." : "批量删除"}
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setSelectAll(false); }}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent"
          >
            取消选择
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-2 px-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={toggleSelectAll}
            className="w-4 h-4 accent-primary"
          />
          全选
        </label>
        <span className="text-xs text-muted-foreground">
          共 {filteredConversations.length} 条对话{filterDays > 0 ? `（最近${filterDays}天）` : ''}
        </span>
      </div>

      <div className="space-y-2">
        {filteredConversations.map((conv) => (
          <div key={conv.id} className={`bg-card border rounded-xl overflow-hidden ${selectedIds.has(conv.id) ? 'border-primary' : 'border-border'}`}>
            <div
              className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-accent/50 transition-colors flex-wrap gap-1"
              onClick={() => loadMessages(conv.id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(conv.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(conv.id); }}
                  className="w-4 h-4 accent-primary flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{conv.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {conv.model_id} · {conv.msg_count || 0}条消息 · {timeAgo(conv.updated_at || conv.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{expandedId === conv.id ? '收起' : '展开'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {expandedId === conv.id && (
              <div className="border-t border-border p-4 space-y-3 max-h-96 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <div className="text-xs opacity-70 mb-1">{msg.role}</div>
                      <p className="whitespace-pre-wrap">{msg.content.slice(0, 500)}{msg.content.length > 500 ? '...' : ''}</p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">No messages</div>
                )}
              </div>
            )}
          </div>
        ))}
        {filteredConversations.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {conversations.length === 0 ? 'No conversations yet' : '没有符合筛选条件的对话'}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ initialSubTab = "basic" }: { initialSubTab?: "basic" | "advanced" | "oauth" }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    system_prompt: '',
    design_system_prompt: '',
    followup_report_prompt: '',
    site_title: '',
    site_description: '',
    default_model: '',
  });
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<{id: string; name: string}[]>([]);

  const [modeTemps, setModeTemps] = useState({ coding: 0, writing: 0.7, analysis: 0.1, design: 0.3, chat: 0.5 });
  const [modePrompts, setModePrompts] = useState({
    coding: '',
    writing: '\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u6587\u6848\u5199\u4f5c\u52a9\u624b\u3002\n\u3010\u89c4\u5219\u3011\u76f4\u63a5\u7ed9\u5185\u5bb9\uff0c\u4e0d\u7528Markdown\u3002\u6839\u636e\u573a\u666f\u8c03\u6574\u8bed\u6c14\u3002\u6ca1\u6307\u5b9a\u98ce\u683c\u7ed92-3\u4e2a\u7248\u672c\u3002\u5b8c\u6210\u540e1-2\u53e5\u603b\u7ed3\u3002',
    analysis: '\u4f60\u662f\u6570\u636e\u5206\u6790\u4e0e\u7b56\u7565\u987e\u95ee\u3002\n\u3010\u89c4\u5219\u3011\u5148\u7ed3\u8bba\u540e\u5c55\u5f00\u3002\u4e0d\u7528Markdown\u3002\u6ce8\u660e\u6765\u6e90\u3002\u4e0d\u786e\u5b9a\u5c31\u8bf4\u660e\u3002\u5b8c\u6210\u540e\u603b\u7ed3\u6838\u5fc3\u7ed3\u8bba\u3002',
    design: '\u4f60\u662fUI/UX\u8bbe\u8ba1\u987e\u95ee\u3002\n\u3010\u89c4\u5219\u3011\u7ed9\u5177\u4f53\u6570\u503c\u3002\u4e0d\u7528Markdown\u3002\u7ed9\u5b8c\u6574\u65b9\u6848\u4e0d\u9010\u6b65\u8ffd\u95ee\u3002\u5b8c\u6210\u540e\u603b\u7ed3\u8981\u70b9\u3002',
    chat: '\u4f60\u662f\u667a\u80fd\u52a9\u624b\u3002\n\u3010\u89c4\u5219\u3011\u7b80\u6d01\u81ea\u7136\u3002\u4e0d\u7528Markdown\u3002\u4e0d\u7f16\u9020\u3002\u957f\u56de\u7b54\u6700\u540e1\u53e5\u603b\u7ed3\u3002',
  });
  const [advConfig, setAdvConfig] = useState({
    max_steps: 5,
    max_retries: 3,
    tool_timeout_seconds: 120,
    timeout_step: 30,
    memory_context_limit: 30,
    auto_memory_extract: true,
    sub_agent_models: 'deepseek-v4-flash,glm-5-turbo,qwen-3.7-flash',
    topP: 0.9,
    presencePenalty: 0,
    frequencyPenalty: 0,
    seed: -1,
    max_output_tokens: 16384,
    enable_thinking: true,
    thinking_mode: 'auto',
    reasoning_effort: 'high',
    cron_secret: 'ai-platform-cron-2026',
    error_threshold_stuck: 3,
    memory_extract_max_length: 3000,
    tool_history_limit: 50,
    cron_task_limit: 10,
    // 上下文压缩参数
    context_compress_threshold: 80000,
    context_compress_ratio: 0.5,
    max_tool_output_chars: 8000,
  });
  const [modelRoutingConfig, setModelRoutingConfig] = useState<{
    intent_model_priority: Record<string, string>;
    intent_provider_priority: string;
    vision_model_priority: string;
    multimodal_model_order: string;
    provider_max_tokens: string;
    fallback_model_order: string;
    fallback_providers: string;
    default_temperature: string;
  }>({
    intent_model_priority: {},
    intent_provider_priority: '',
    vision_model_priority: '',
    multimodal_model_order: '',
    provider_max_tokens: '',
    fallback_model_order: '',
    fallback_providers: '',
    default_temperature: '0.3',
  });
  const [showModelRouting, setShowModelRouting] = useState(false);
  const [sandboxConfig, setSandboxConfig] = useState({timeout: 30, max_output_length: 10000, enable_network: false, temp_dir: '/tmp/ai-sandbox'});
  const [showSandbox, setShowSandbox] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'basic' | 'advanced' | 'oauth'>(initialSubTab);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModeTemps, setShowModeTemps] = useState(false);
  const [showModePrompts, setShowModePrompts] = useState(false);
  const [modelTokenConfigs, setModelTokenConfigs] = useState<{modelId: string; name: string; provider: string; default_temperature: number; default_max_tokens: number; default_top_p: number | null; default_presence_penalty: number | null; default_frequency_penalty: number | null}[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchModels();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setSettings(data.data);
        setForm({
          system_prompt: data.data.system_prompt || '',
          design_system_prompt: data.data.design_system_prompt || '',
          followup_report_prompt: data.data.followup_report_prompt || '',
          site_title: data.data.site_title || '',
          site_description: data.data.site_description || '',
          default_model: data.data.default_model || '',
        });
        try { if (data.data.mode_temperatures) setModeTemps(JSON.parse(data.data.mode_temperatures)); } catch {}
        // Fetch model token configs
        try {
          const modelRes = await fetch('/api/models');
          const modelData = await modelRes.json();
          if (modelData.data) {
            setModelTokenConfigs(modelData.data.map((m: any) => ({
              modelId: m.modelId,
              name: m.name || m.modelId,
              provider: m.provider,
              default_temperature: m.default_temperature || 0.7,
              default_max_tokens: m.default_max_tokens || 4096,
              default_top_p: m.default_top_p ?? null,
              default_presence_penalty: m.default_presence_penalty ?? null,
              default_frequency_penalty: m.default_frequency_penalty ?? null,
            })));
          }
        } catch {}
        try { if (data.data.mode_prompts) setModePrompts(JSON.parse(data.data.mode_prompts)); } catch {}
        // Load model routing config (parse intent_model_priority JSON for per-intent editing)
        try {
          const mrc: any = {};
          const keys = ['intent_provider_priority','vision_model_priority','multimodal_model_order','provider_max_tokens','fallback_model_order','fallback_providers','default_temperature'];
          for (const k of keys) { if (data.data[k]) mrc[k] = data.data[k]; }
          // intent_model_priority is JSON string like {"coding":"...","chat":"..."}, parse for editing
          if (data.data.intent_model_priority) {
            try {
              const impObj = JSON.parse(data.data.intent_model_priority);
              // Convert arrays to comma-separated strings for input editing
              const impForEdit: Record<string, string> = {};
              for (const [intent, val] of Object.entries(impObj)) {
                impForEdit[intent] = Array.isArray(val) ? val.join(',') : String(val || '');
              }
              mrc.intent_model_priority = impForEdit; // Store as comma-separated strings for per-intent inputs
            } catch {
              mrc.intent_model_priority = {};
            }
          }
          if (Object.keys(mrc).length > 0) setModelRoutingConfig(prev => ({...prev, ...mrc}));
        } catch {}
        try { if (data.data.advanced_config) { const adv = JSON.parse(data.data.advanced_config); setAdvConfig(prev => ({ ...prev, ...adv })); } } catch {}
        try { if (data.data.sandbox_config) { setSandboxConfig(prev => ({ ...prev, ...JSON.parse(data.data.sandbox_config) })); } } catch {}
      }
    } catch (err) { console.error('Failed to fetch settings:', err); }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.data) setModels(data.data.map((m: any) => ({ id: m.model_id, name: m.display_name })));
    } catch (err) { console.error('Failed to fetch models:', err); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'system_prompt', value: form.system_prompt }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'design_system_prompt', value: form.design_system_prompt }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'followup_report_prompt', value: form.followup_report_prompt }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'site_title', value: form.site_title }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'site_description', value: form.site_description }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'default_model', value: form.default_model }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'mode_temperatures', value: JSON.stringify(modeTemps) }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'mode_prompts', value: JSON.stringify(modePrompts) }) }),
        // Save model routing config (stringify intent_model_priority back to JSON for DB)
        ...Object.entries(modelRoutingConfig).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => {
          const saveValue = k === 'intent_model_priority' ? JSON.stringify(Object.fromEntries(Object.entries(v as Record<string,string>).map(([ik, iv]) => [ik, typeof iv === 'string' && iv.includes(',') ? iv.split(',').map(s=>s.trim()).filter(Boolean) : iv]))) : (typeof v === 'string' ? v : JSON.stringify(v));
          return fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k, value: saveValue }) });
        }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sandbox_config', value: JSON.stringify(sandboxConfig) }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'advanced_config', value: JSON.stringify(advConfig) }) }),
      ]);
      // Save model token configs
      try {
        await Promise.all(modelTokenConfigs.map(mc =>
          fetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model_id: mc.modelId,
              display_name: mc.name,
              provider: mc.provider,
              default_temperature: mc.default_temperature,
              default_max_tokens: mc.default_max_tokens,
              default_top_p: mc.default_top_p,
              default_presence_penalty: mc.default_presence_penalty,
              default_frequency_penalty: mc.default_frequency_penalty,
              is_enabled: true,
            }),
          })
        ));
      } catch (err) { console.error('Failed to save model token configs:', err); }
      toast.success('\u8bbe\u7f6e\u5df2\u4fdd\u5b58\uff01');
      fetchSettings();
    } catch (err) { console.error('Failed to save settings:', err); toast.error('\u4fdd\u5b58\u5931\u8d25'); }
    finally { setLoading(false); }
  };

  const modeLabels: Record<string, string> = { coding: '\u7f16\u7a0b', writing: '\u5199\u4f5c', analysis: '\u5206\u6790', design: '\u8bbe\u8ba1', chat: '\u804a\u5929' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">{'\u7cfb\u7edf\u8bbe\u7f6e'}</h2>
        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
          <Save size={14} /> {loading ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58\u8bbe\u7f6e'}
        </button>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 border-b border-border pb-2 sm:pb-3 flex-wrap">
        <button
          onClick={() => setSettingsSubTab('basic')}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            settingsSubTab === 'basic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          基本设置
        </button>
        <button
          onClick={() => setSettingsSubTab('advanced')}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            settingsSubTab === 'advanced' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          高级参数
        </button>
        <button
          onClick={() => setSettingsSubTab('oauth')}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            settingsSubTab === 'oauth' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          第三方登录
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <h3 className="font-medium mb-3">{'\u7cfb\u7edf\u63d0\u793a\u8bcd (System Prompt)'}</h3>
          <p className="text-xs text-muted-foreground mb-3">{'\u8bbe\u7f6e AI \u7684\u7cfb\u7edf\u63d0\u793a\u8bcd\uff0c\u5f71\u54cd\u7f16\u7a0b\u6a21\u5f0f\u7684\u5bf9\u8bdd\u3002'}</p>
          <textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={8}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono" placeholder={''} />
        </div>

        
                <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <h3 className="font-medium mb-3">{'编程模式提示词 (Coding Prompt)'}</h3>
          <p className="text-xs text-muted-foreground mb-3">{'设置编程模式的专用提示词，控制 AI 编程助手如何使用工具、改代码、构建部署。核心闭环流程指令在这里配置。'}</p>
          <textarea value={modePrompts.coding || ''} onChange={(e) => setModePrompts({ ...modePrompts, coding: e.target.value })} rows={12}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono whitespace-pre-wrap" placeholder={'在此输入编程模式提示词...'} />
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <h3 className="font-medium mb-3">{'设计提示词 (Design Prompt)'}</h3>
          <p className="text-xs text-muted-foreground mb-3">{'设置设计工坊的专用提示词，影响 AI 设计助手的对话风格和能力。独立于编程提示词。'}</p>
          <textarea value={form.design_system_prompt} onChange={(e) => setForm({ ...form, design_system_prompt: e.target.value })} rows={10}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono whitespace-pre-wrap" placeholder={'在此输入设计提示词...'} />
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <h3 className="font-medium mb-3">{'工具调用报告提示词 (Follow-up Report Prompt)'}</h3>
          <p className="text-xs text-muted-foreground mb-3">{'当AI调用工具后生成分析报告时使用的提示词。控制报告格式（摘要+详细内容分离）。修改后即时生效。支持换行。'}</p>
          <textarea value={form.followup_report_prompt} onChange={(e) => setForm({ ...form, followup_report_prompt: e.target.value })} rows={10}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono whitespace-pre-wrap" placeholder={"在此输入报告生成提示词..."} />
        </div>

<div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <h3 className="font-medium mb-3">{'\u7f51\u7ad9\u4fe1\u606f'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{'\u7f51\u7ad9\u6807\u9898'}</label>
              <input value={form.site_title} onChange={(e) => setForm({ ...form, site_title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{'\u7f51\u7ad9\u63cf\u8ff0'}</label>
              <input value={form.site_description} onChange={(e) => setForm({ ...form, site_description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <h3 className="font-medium mb-3">{'\u9ed8\u8ba4\u6a21\u578b'}</h3>
          <select value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="">-- {'\u9009\u62e9\u9ed8\u8ba4\u6a21\u578b'} --</option>
            {models.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{'\u5404\u6a21\u5f0f\u6e29\u5ea6\u914d\u7f6e'}</h3>
            <button onClick={() => setShowModeTemps(!showModeTemps)} className="text-sm text-primary hover:underline">
              {showModeTemps ? '\u6536\u8d77' : '\u5c55\u5f00'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{'\u6e29\u5ea6\u8d8a\u4f4e\u8f93\u51fa\u8d8a\u7cbe\u786e\u7a33\u5b9a\uff0c\u8d8a\u9ad8\u8d8a\u6709\u521b\u610f\u3002\u7f16\u7a0b\u5efa\u8bae 0\uff0c\u5199\u4f5c/\u804a\u5929\u5efa\u8bae 0.5-0.8\u3002'}</p>
          {showModeTemps && (
            <div className="space-y-4">
              {Object.entries(modeLabels).map(([key, label]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-sm w-16">{label}</span>
                  <input type="range" min="0" max="1" step="0.1" value={(modeTemps as any)[key]}
                    onChange={(e) => setModeTemps({ ...modeTemps, [key]: parseFloat(e.target.value) })}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
                  <span className="text-sm font-mono w-8">{(modeTemps as any)[key].toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'basic' ? 'block' : 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{'\u5404\u6a21\u5f0f\u63d0\u793a\u8bcd\u914d\u7f6e'}</h3>
            <button onClick={() => setShowModePrompts(!showModePrompts)} className="text-sm text-primary hover:underline">
              {showModePrompts ? '\u6536\u8d77' : '\u5c55\u5f00'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{'\u81ea\u5b9a\u4e49\u5404\u6a21\u5f0f\u7684\u7cfb\u7edf\u63d0\u793a\u8bcd\uff08\u7f16\u7a0b\u6a21\u5f0f\u5df2\u5728\u4e0a\u65b9\u5355\u72ec\u914d\u7f6e\uff09\u3002'}</p>
          {showModePrompts && (
            <div className="space-y-4">
              {Object.entries(modeLabels).filter(([k]) => k !== 'coding').map(([key, label]) => (
                <div key={key}>
                  <label className="text-sm text-muted-foreground block mb-1">{label}{'\u6a21\u5f0f\u63d0\u793a\u8bcd'}</label>
                  <textarea value={(modePrompts as any)[key]}
                    onChange={(e) => setModePrompts({ ...modePrompts, [key]: e.target.value })}
                    rows={10}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono whitespace-pre-wrap" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'advanced' ? 'block' : 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{'\u9ad8\u7ea7\u53c2\u6570\u914d\u7f6e'}</h3>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-primary hover:underline">
              {showAdvanced ? '\u6536\u8d77' : '\u5c55\u5f00'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{'\u8c03\u6574\u5de5\u5177\u6267\u884c\u3001\u8bb0\u5fc6\u7cfb\u7edf\u7b49\u9ad8\u7ea7\u53c2\u6570\u3002\u4e00\u822c\u4f7f\u7528\u9ed8\u8ba4\u503c\u5373\u53ef\u3002'}</p>
          {(settingsSubTab === 'advanced') && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'\u5de5\u5177\u6267\u884c\u8d85\u65f6\uff08\u79d2\uff09'}</label>
                  <input type="number" value={advConfig.tool_timeout_seconds}
                    onChange={(e) => setAdvConfig({ ...advConfig, tool_timeout_seconds: parseInt(e.target.value) || 120 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={30} max={600} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'\u6700\u5927\u6b65\u9aa4\u6570'}</label>
                  <input type="number" value={advConfig.max_steps}
                    onChange={(e) => setAdvConfig({ ...advConfig, max_steps: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={3} max={50} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'\u6700\u5927\u91cd\u8bd5\u6b21\u6570'}</label>
                  <input type="number" value={advConfig.max_retries}
                    onChange={(e) => setAdvConfig({ ...advConfig, max_retries: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={0} max={10} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'\u8bb0\u5fc6\u4e0a\u4e0b\u6587\u6761\u6570'}</label>
                  <input type="number" value={advConfig.memory_context_limit}
                    onChange={(e) => setAdvConfig({ ...advConfig, memory_context_limit: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={5} max={100} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'\u81ea\u52a8\u8bb0\u5fc6\u63d0\u53d6'}</label>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={advConfig.auto_memory_extract}
                      onChange={(e) => setAdvConfig({ ...advConfig, auto_memory_extract: e.target.checked })}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm">{'\u81ea\u52a8\u4ece\u5bf9\u8bdd\u4e2d\u63d0\u53d6\u5e76\u4fdd\u5b58\u8bb0\u5fc6'}</span>
                  </label>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'\u5b50\u667a\u80fd\u4f53\u6a21\u578b\u4f18\u5148\u7ea7\uff08\u9017\u53f7\u5206\u9694\uff09'}</label>
                  <input type="text" value={advConfig.sub_agent_models}
                    onChange={(e) => setAdvConfig({ ...advConfig, sub_agent_models: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                    placeholder="deepseek-v4-flash,glm-5-turbo" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'单步超时（秒）'}</label>
                  <input type="number" value={advConfig.timeout_step}
                    onChange={(e) => setAdvConfig({ ...advConfig, timeout_step: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={10} max={120} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'最大输出 Token 数'}</label>
                  <input type="number" value={advConfig.max_output_tokens}
                    onChange={(e) => setAdvConfig({ ...advConfig, max_output_tokens: parseInt(e.target.value) || 16384 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={1024} max={128000} />
                </div>
              </div>
              {/* 🔧 动态工具沙箱配置 */}
              <h4 className="text-sm font-medium mt-4 mb-2">{'🔧 动态工具沙箱配置'}</h4>
              <div className="text-xs text-muted-foreground mb-3 space-y-1">
                <p>💡 <b>使用说明：</b></p>
                <p>• 控制AI执行动态代码（execute_code）时的安全边界</p>
                <p>• <b>超时时间</b>：代码执行的最大等待秒数，超时自动终止（建议30-120秒）</p>
                <p>• <b>最大输出长度</b>：代码执行的stdout/stderr截断字数，防止大量输出耗尽token</p>
                <p>• <b>允许网络访问</b>：开启后沙箱内代码可发HTTP请求，关闭则仅限本地计算</p>
                <p>• <b>临时目录</b>：沙箱代码的工作目录，文件不持久化</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'⏱️ 超时时间（秒）'}</label>
                  <input type="number" value={sandboxConfig.timeout}
                    onChange={(e) => setSandboxConfig({ ...sandboxConfig, timeout: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={5} max={300} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'📝 最大输出长度（字符）'}</label>
                  <input type="number" value={sandboxConfig.max_output_length}
                    onChange={(e) => setSandboxConfig({ ...sandboxConfig, max_output_length: parseInt(e.target.value) || 10000 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={1000} max={100000} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'🌐 允许网络访问'}</label>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={sandboxConfig.enable_network}
                      onChange={(e) => setSandboxConfig({ ...sandboxConfig, enable_network: e.target.checked })}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm">{'开启后沙箱内代码可发HTTP请求'}</span>
                  </label>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'📁 临时目录路径'}</label>
                  <input type="text" value={sandboxConfig.temp_dir}
                    onChange={(e) => setSandboxConfig({ ...sandboxConfig, temp_dir: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                    placeholder="/tmp/ai-sandbox" />
                </div>
              </div>
              <h4 className="text-sm font-medium mt-4 mb-2">{'模型生成参数（高级）'}</h4>
              <p className="text-xs text-muted-foreground mb-3">{'控制输出多样性、重复惩罚等。一般使用默认值即可。'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'Top P（核采样 0.1-1.0）'}</label>
                  <input type="number" value={advConfig.topP}
                    onChange={(e) => setAdvConfig({ ...advConfig, topP: parseFloat(e.target.value) || 0.9 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={0.1} max={1.0} step={0.05} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'存在惩罚（-2.0~2.0）'}</label>
                  <input type="number" value={advConfig.presencePenalty}
                    onChange={(e) => setAdvConfig({ ...advConfig, presencePenalty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={-2.0} max={2.0} step={0.1} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'频率惩罚（-2.0~2.0）'}</label>
                  <input type="number" value={advConfig.frequencyPenalty}
                    onChange={(e) => setAdvConfig({ ...advConfig, frequencyPenalty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={-2.0} max={2.0} step={0.1} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'随机种子（-1为随机）'}</label>
                  <input type="number" value={advConfig.seed}
                    onChange={(e) => setAdvConfig({ ...advConfig, seed: parseInt(e.target.value) ?? -1 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={-1} max={999999} />
                </div>
              </div>

              <h4 className="text-sm font-medium mt-4 mb-2">{'思考模式（Reasoning）'}</h4>
              <p className="text-xs text-muted-foreground mb-3">{'控制AI是否展示思考过程。推理模型（如DeepSeek R1）会输出思考链，开启后前端可折叠展示。'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'启用思考模式'}</label>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={advConfig.enable_thinking}
                      onChange={(e) => setAdvConfig({ ...advConfig, enable_thinking: e.target.checked })}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm">{'在AI回复中展示思考过程'}</span>
                  </label>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'思考模式策略'}</label>
                  <select value={advConfig.thinking_mode}
                    onChange={(e) => setAdvConfig({ ...advConfig, thinking_mode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
                    <option value="auto">{'自动（推理模型自动开启）'}</option>
                    <option value="always">{'始终开启'}</option>
                    <option value="off">{'始终关闭'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{'思考深度 (DeepSeek)'}</label>
                  <select value={advConfig.reasoning_effort || 'high'}
                    onChange={(e) => setAdvConfig({ ...advConfig, reasoning_effort: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
                    <option value="high">{'High - 标准深度（推荐）'}</option>
                    <option value="max">{'Max - 最深思考（耗时更长）'}</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">控制DeepSeek推理模型的思考深度，影响回复质量和速度</p>
                </div>
              </div>

              <h4 className="text-sm font-medium mt-4 mb-2">{'Agent 状态管理'}</h4>
              <p className="text-xs text-muted-foreground mb-3">控制AI Agent的行为参数：错误恢复策略、跨对话记忆、定时任务调度等。</p>
        <div className="text-xs text-muted-foreground/70 mb-4 space-y-1 bg-muted/30 rounded-lg p-3">
          <p>⚙️ <b>最大步数(max_steps)</b>：AI单次对话最多执行的工具调用轮数。推荐5-20，太低会截断复杂任务，太高可能死循环。</p>
          <p>⚙️ <b>最大重试(max_retries)</b>：工具调用失败后自动重试次数。推荐3，网络不稳定可调高。</p>
          <p>⚙️ <b>工具超时(tool_timeout)</b>：单个工具执行超时时间（秒）。SSH命令推荐120，简单API调用可30-60。</p>
          <p>⚙️ <b>步超时(timeout_step)</b>：单步（含AI思考+工具执行）超时（秒）。推荐30-60。</p>
          <p>⚙️ <b>最大输出token(max_output_tokens)</b>：AI单次回复最大长度。16384≈12000字，4096≈3000字。长代码/报告建议8192+。</p>
          <p>⚙️ <b>Top-P</b>：采样范围，0.9=从概率前90%的词中选。越低越确定，越高越随机。与temperature配合使用。</p>
          <p>⚙️ <b>Presence/Frequency Penalty</b>：-2到2，正值减少重复，负值增加重复。0=不调整。</p>
          <p>⚙️ <b>Seed</b>：随机种子。-1=随机，固定值=可复现输出（同参数同输入得同结果）。</p>
          <p>⚙️ <b>记忆上下文条数(memory_context_limit)</b>：对话中携带的最近N条记忆。推荐20-50，太多浪费token。</p>
          <p>⚙️ <b>自动提取记忆(auto_memory_extract)</b>：AI是否自动从对话中提取重要信息存入长期记忆。</p>
          <p>⚙️ <b>子智能体模型(sub_agent_models)</b>：并行子智能体使用的模型，逗号分隔。按优先级排列，第一个为主模型。</p>
          <p>⚙️ <b>Cron密钥(cron_secret)</b>：定时任务API的安全密钥，防止未授权调用。修改后需同步更新宝塔定时任务URL。</p>
          <p>⚙️ <b>卡住阈值(error_threshold_stuck)</b>：同一对话连续失败N次后标记为"卡住"。推荐3-5。</p>
          <p>⚙️ <b>记忆提取长度(memory_extract_max_length)</b>：单次记忆提取最大字符数。推荐2000-5000。</p>
          <p>⚙️ <b>工具历史条数(tool_history_limit)</b>：上下文中保留的最近工具调用记录数。推荐30-100。</p>
          <p>⚙️ <b>Cron任务上限(cron_task_limit)</b>：同时活跃的定时任务最大数量。防止任务堆积。</p>
          <p>⚙️ <b>模型Token配置</b>：每个模型可单独设置默认温度、最大token、Top-P等。未设置的模型使用上方全局值。</p>
        </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Cron调度密钥</label>
                  <input type="text" value={advConfig.cron_secret || 'ai-platform-cron-2026'}
                    onChange={(e) => setAdvConfig({ ...advConfig, cron_secret: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono" />
                  <p className="text-xs text-muted-foreground mt-1">调用 /api/cron 端点的验证密钥</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">错误恢复阈值（标记stuck）</label>
                  <input type="number" min="1" max="10" value={advConfig.error_threshold_stuck ?? 3}
                    onChange={(e) => setAdvConfig({ ...advConfig, error_threshold_stuck: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">连续失败N次后标记为stuck，触发策略切换</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">记忆提取最大长度</label>
                  <input type="number" min="500" max="10000" step="500" value={advConfig.memory_extract_max_length ?? 3000}
                    onChange={(e) => setAdvConfig({ ...advConfig, memory_extract_max_length: parseInt(e.target.value) || 3000 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">跨对话记忆提取时，对话内容的最大字符数</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">工具历史保留条数</label>
                  <input type="number" min="10" max="200" step="10" value={advConfig.tool_history_limit ?? 50}
                    onChange={(e) => setAdvConfig({ ...advConfig, tool_history_limit: parseInt(e.target.value) || 50 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">每次对话保留的工具调用记录数量上限</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Cron每次执行任务上限</label>
                  <input type="number" min="1" max="50" value={advConfig.cron_task_limit ?? 10}
                    onChange={(e) => setAdvConfig({ ...advConfig, cron_task_limit: parseInt(e.target.value) || 10 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">每次cron触发最多执行的任务数</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">上下文压缩阈值（tokens估算）</label>
                  <input type="number" min={30000} max={200000} step={5000} value={advConfig.context_compress_threshold ?? 80000}
                    onChange={(e) => setAdvConfig({ ...advConfig, context_compress_threshold: parseInt(e.target.value) || 80000 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">上下文超过此值时触发摘要式压缩（建议60000-100000）</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">上下文压缩比例</label>
                  <input type="number" min={0.2} max={0.8} step={0.05} value={advConfig.context_compress_ratio ?? 0.5}
                    onChange={(e) => setAdvConfig({ ...advConfig, context_compress_ratio: parseFloat(e.target.value) || 0.5 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">0.5=保留后半段对话，0.3=只保留后30%</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">工具输出截断长度（字符）</label>
                  <input type="number" min={1000} max={50000} step={1000} value={advConfig.max_tool_output_chars ?? 8000}
                    onChange={(e) => setAdvConfig({ ...advConfig, max_tool_output_chars: parseInt(e.target.value) || 8000 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">单个工具输出超过此长度自动截断，防止撑爆上下文</p>
                </div>
              </div>

              <h4 className="text-sm font-medium mt-4 mb-2">{'模型微调参数'}</h4>
              <p className="text-xs text-muted-foreground mb-3">{'按模型设置微调参数。温度/TopP控制输出随机性，惩罚项控制重复倾向，MaxTokens控制最大输出长度。留空则使用全局默认值。'}</p>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {modelTokenConfigs.map((mc, idx) => (
                  <div key={mc.modelId} className="bg-background/50 rounded-lg px-3 py-2 border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate" title={mc.modelId}>{mc.name || mc.modelId}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{mc.modelId}</div>
                      </div>
                      <span className="text-[10px] text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{mc.provider}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">温度</label>
                        <input type="number" value={mc.default_temperature}
                          onChange={(e) => {
                            const newConfigs = [...modelTokenConfigs];
                            newConfigs[idx] = { ...newConfigs[idx], default_temperature: parseFloat(e.target.value) || 0.7 };
                            setModelTokenConfigs(newConfigs);
                          }}
                          className="w-14 px-1.5 py-1 rounded bg-background border border-border text-xs text-center outline-none focus:border-primary" min={0} max={2} step={0.1} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">TopP</label>
                        <input type="number" value={mc.default_top_p ?? ''}
                          placeholder="全局"
                          onChange={(e) => {
                            const newConfigs = [...modelTokenConfigs];
                            newConfigs[idx] = { ...newConfigs[idx], default_top_p: e.target.value === '' ? null : parseFloat(e.target.value) };
                            setModelTokenConfigs(newConfigs);
                          }}
                          className="w-14 px-1.5 py-1 rounded bg-background border border-border text-xs text-center outline-none focus:border-primary" min={0.1} max={1.0} step={0.05} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">存在惩罚</label>
                        <input type="number" value={mc.default_presence_penalty ?? ''}
                          placeholder="全局"
                          onChange={(e) => {
                            const newConfigs = [...modelTokenConfigs];
                            newConfigs[idx] = { ...newConfigs[idx], default_presence_penalty: e.target.value === '' ? null : parseFloat(e.target.value) };
                            setModelTokenConfigs(newConfigs);
                          }}
                          className="w-14 px-1.5 py-1 rounded bg-background border border-border text-xs text-center outline-none focus:border-primary" min={-2.0} max={2.0} step={0.1} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">频率惩罚</label>
                        <input type="number" value={mc.default_frequency_penalty ?? ''}
                          placeholder="全局"
                          onChange={(e) => {
                            const newConfigs = [...modelTokenConfigs];
                            newConfigs[idx] = { ...newConfigs[idx], default_frequency_penalty: e.target.value === '' ? null : parseFloat(e.target.value) };
                            setModelTokenConfigs(newConfigs);
                          }}
                          className="w-14 px-1.5 py-1 rounded bg-background border border-border text-xs text-center outline-none focus:border-primary" min={-2.0} max={2.0} step={0.1} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">Max Tokens</label>
                        <input type="number" value={mc.default_max_tokens}
                          onChange={(e) => {
                            const newConfigs = [...modelTokenConfigs];
                            newConfigs[idx] = { ...newConfigs[idx], default_max_tokens: parseInt(e.target.value) || 4096 };
                            setModelTokenConfigs(newConfigs);
                          }}
                          className="w-20 px-1.5 py-1 rounded bg-background border border-border text-xs text-center outline-none focus:border-primary" min={1024} max={128000} step={1024} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========== 智能模型路由配置 ========== */}
        <div className="bg-card border border-border rounded-xl p-4" style={{ display: settingsSubTab === 'advanced' ? 'block' : 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{'🧭 智能模型路由配置'}</h3>
            <button onClick={() => setShowModelRouting(!showModelRouting)} className="text-sm text-primary hover:underline">
              {showModelRouting ? '收起' : '展开'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">控制不同意图（编程/聊天/分析等）使用哪些模型。按优先级排列，第一个为主模型，后面的为备选。修改后即时生效。</p>
          {showModelRouting && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'编程模式模型优先级 (coding)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.coding || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.coding = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-5.5-thinking,gpt-5.4-thinking,gpt-4.1" />
                <p className="text-xs text-muted-foreground mt-1">逗号分隔，第一个为首选。影响AI编程能力的核心配置</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'聊天模式模型优先级 (chat)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.chat || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.chat = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-5.5,deepseek-v4-flash,qwen-turbo" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'分析模式模型优先级 (analysis)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.analysis || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.analysis = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-5.5-thinking,gpt-5.4-thinking,deepseek-v4-pro" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'写作模式模型优先级 (writing)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.writing || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.writing = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-5.5,gpt-5.4-mini,qwen-max" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'设计模式模型优先级 (design)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.design || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.design = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-5.5,gpt-4.1,claude-sonnet-4-5" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'视觉/图片模型优先级 (visual)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.visual || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.visual = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-4.1,claude-sonnet-4-5,glm-5v-turbo" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'生图模型优先级 (image)'}</label>
                <input type="text" value={modelRoutingConfig.intent_model_priority?.image || ''}
                  onChange={(e) => {
                    const imp = { ...modelRoutingConfig.intent_model_priority };
                    imp.image = e.target.value;
                    setModelRoutingConfig({ ...modelRoutingConfig, intent_model_priority: imp });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-image-2" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'Fallback模型顺序（全局兜底）'}</label>
                <input type="text" value={modelRoutingConfig.fallback_model_order}
                  onChange={(e) => setModelRoutingConfig({ ...modelRoutingConfig, fallback_model_order: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-5.5,gpt-5.5-thinking,gpt-4.1,deepseek-v4-flash" />
                <p className="text-xs text-muted-foreground mt-1">当意图路由失败时的全局兜底模型顺序，逗号分隔</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'视觉模型优先级（多模态图片识别）'}</label>
                <input type="text" value={modelRoutingConfig.vision_model_priority}
                  onChange={(e) => setModelRoutingConfig({ ...modelRoutingConfig, vision_model_priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-4.1,claude-sonnet-4-5,glm-5v-turbo" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'多模态模型顺序'}</label>
                <input type="text" value={modelRoutingConfig.multimodal_model_order}
                  onChange={(e) => setModelRoutingConfig({ ...modelRoutingConfig, multimodal_model_order: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="gpt-4o,gpt-4.1,gemini-2.5-pro" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'Provider最大Token映射（JSON）'}</label>
                <textarea value={modelRoutingConfig.provider_max_tokens}
                  onChange={(e) => setModelRoutingConfig({ ...modelRoutingConfig, provider_max_tokens: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder='{"deepseek":16384,"groq":8192,"moonshot":8192}' />
                <p className="text-xs text-muted-foreground mt-1">各Provider的默认最大Token限制，JSON格式</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{'Fallback Provider顺序'}</label>
                <input type="text" value={modelRoutingConfig.fallback_providers}
                  onChange={(e) => setModelRoutingConfig({ ...modelRoutingConfig, fallback_providers: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                  placeholder="openai,deepseek,qwen" />
                <p className="text-xs text-muted-foreground mt-1">当首选Provider不可用时的备选Provider顺序</p>
              </div>
            </div>
          )}
        </div>

        {settingsSubTab === 'oauth' && <AuthSettingsPanel />}
      </div>
    </div>
  );
}




// ============ 技能管理面板 (P51) ============
function SkillsPanel() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', instructions: '', category: 'general', priority: 100, is_active: true });
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'} | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/skills');
      const data = await res.json();
      if (data.skills) setSkills(data.skills);
    } catch (e: any) { setToast({msg: '加载失败: ' + e.message, type: 'error'}); }
    setLoading(false);
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleSave = async (skillData: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/skills', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(skillData) });
      const data = await res.json();
      if (data.success) { setToast({msg: '保存成功', type: 'success'}); loadSkills(); setShowAdd(false); setEditingId(null); }
      else setToast({msg: '保存失败: ' + data.error, type: 'error'});
    } catch (e: any) { setToast({msg: '保存失败: ' + e.message, type: 'error'}); }
    setSaving(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/skills', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, is_active: isActive }) });
      loadSkills();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此技能？')) return;
    try {
      await fetch('/api/admin/skills?id=' + id, { method: 'DELETE' });
      setToast({msg: '已删除', type: 'success'}); loadSkills();
    } catch (e: any) { setToast({msg: '删除失败', type: 'error'}); }
  };

  const categories = [...new Set(skills.map(s => s.category || 'general'))];
  const catIcons: Record<string, string> = { filesystem: '📁', 'sub-agent': '🤖', general: '⚡' };
  const catNames: Record<string, string> = { filesystem: '文件系统技能', 'sub-agent': '子智能体', general: '通用技能' };

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{toast.msg}<button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setToast(null)}>✕</button></div>}
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">技能管理</h3>
          <p className="text-xs text-gray-400 mt-1">渐进式披露：系统提示词只注入技能目录(~50t/技能)，任务匹配时通过 activate_skill 加载完整指令</p>
        </div>
        <button onClick={() => { setForm({name:'',description:'',instructions:'',category:'general',priority:100,is_active:true}); setShowAdd(true); }} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg flex items-center gap-1"><Plus size={14}/> 新增技能</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1a2e] rounded-lg p-3 border border-white/5">
          <div className="text-2xl font-bold text-white">{skills.length}</div>
          <div className="text-xs text-gray-400">总技能数</div>
        </div>
        <div className="bg-[#1a1a2e] rounded-lg p-3 border border-white/5">
          <div className="text-2xl font-bold text-green-400">{skills.filter(s => s.is_active).length}</div>
          <div className="text-xs text-gray-400">已激活</div>
        </div>
        <div className="bg-[#1a1a2e] rounded-lg p-3 border border-white/5">
          <div className="text-2xl font-bold text-violet-400">{skills.reduce((a, s) => a + (s.token_estimate || 0), 0).toLocaleString()}</div>
          <div className="text-xs text-gray-400">估算总Token</div>
        </div>
      </div>

      {loading ? <div className="text-gray-400 text-center py-8">加载中...</div> : categories.map(cat => (
        <div key={cat} className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">{catIcons[cat] || '⚡'} {catNames[cat] || cat} <span className="text-gray-500">({skills.filter(s => (s.category||'general') === cat).length})</span></h4>
          <div className="space-y-2">
            {skills.filter(s => (s.category||'general') === cat).map(skill => (
              <div key={skill.id} className="bg-[#1a1a2e] rounded-lg border border-white/5 overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button onClick={() => handleToggle(skill.id, !skill.is_active)} className={`w-8 h-4 rounded-full transition-colors ${skill.is_active ? 'bg-green-500' : 'bg-gray-600'} relative`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${skill.is_active ? 'left-4' : 'left-0.5'}`}/>
                    </button>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{skill.name} <span className="text-gray-500 text-xs">({skill.id})</span></div>
                      <div className="text-gray-400 text-xs truncate">{skill.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">~{skill.token_estimate || 0}t</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400">P{skill.priority}</span>
                    <button onClick={() => { setEditingId(skill.id); setForm({name:skill.name,description:skill.description,instructions:skill.instructions||'',category:skill.category||'general',priority:skill.priority||100,is_active:skill.is_active}); }} className="text-gray-400 hover:text-white"><Edit2 size={14}/></button>
                    <button onClick={() => handleDelete(skill.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={14}/></button>
                  </div>
                </div>
                {editingId === skill.id && (
                  <div className="p-3 border-t border-white/5 space-y-2">
                    <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="技能描述"/>
                    <textarea value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white h-40 font-mono" placeholder="技能指令（SKILL.md正文，激活时加载到上下文）"/>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="分类"/>
                      <input type="number" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)||100})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="优先级"/>
                      <button onClick={() => handleSave({id: skill.id, ...form})} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white text-sm rounded py-1.5 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#12121c] rounded-xl border border-white/10 p-6 w-[500px] max-h-[80vh] overflow-y-auto space-y-3">
            <h3 className="text-lg font-semibold text-white">新增技能</h3>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="技能名称"/>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="技能描述（何时使用此技能）"/>
            <textarea value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white h-48 font-mono" placeholder="技能指令（激活时加载到上下文的完整指令）"/>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="分类 (general/sub-agent/filesystem)"/>
              <input type="number" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)||100})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white" placeholder="优先级"/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleSave(form)} disabled={saving || !form.name} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg py-2 disabled:opacity-50">{saving ? '保存中...' : '创建技能'}</button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-lg">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============ 子智能体配置面板 ============
function SubAgentsPanel() {
  const [configs, setConfigs] = useState<Record<string, {description: string; defaultTimeout: number; instructions?: string; toolNames?: string[]; temperature?: number; preferredModel?: string; maxSteps?: number}>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => { fetchConfigs(); }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.data?.sub_agent_configs) {
        try {
          setConfigs(JSON.parse(data.data.sub_agent_configs));
        } catch { setConfigs({}); }
      }
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'sub_agent_configs', value: JSON.stringify(configs) }),
      });
      setSaving(false);
    } catch { setSaving(false); }
  };

  const agentIcons: Record<string, string> = {
    researcher: '🔍', coder: '💻', reviewer: '👀',
    writer: '✍️', tester: '🧪', planner: '📋',
    deployer: '🚀', analyst: '📊', debugger: '🐛',
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">子智能体配置</h2>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
          {saving ? '保存中...' : '💾 保存配置'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">配置各子智能体的描述、超时和提示词。修改后点击保存即时生效（已有的硬编码提示词作为默认值）。</p>
      
      <div className="space-y-3">
        {Object.entries(configs).map(([key, cfg]) => (
          <div key={key} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 cursor-pointer flex items-center justify-between hover:bg-accent/50 transition-colors"
              onClick={() => setExpandedAgent(expandedAgent === key ? null : key)}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{agentIcons[key] || '🤖'}</span>
                <div>
                  <div className="font-medium">{key}</div>
                  <div className="text-xs text-muted-foreground">{cfg.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">超时: {cfg.defaultTimeout}s</span>
                <span className="text-xs text-muted-foreground">工具: {(cfg.toolNames || []).length}个</span>
                {cfg.preferredModel && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{cfg.preferredModel}</span>}
                <span className="text-muted-foreground">{expandedAgent === key ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedAgent === key && (
              <div className="p-4 border-t border-border space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">描述</label>
                  <input type="text" value={cfg.description}
                    onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, description: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">默认超时（秒）</label>
                  <input type="number" value={cfg.defaultTimeout} min={10} max={600}
                    onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, defaultTimeout: parseInt(e.target.value) || 60 } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">提示词</label>
                  <textarea value={cfg.instructions || ''}
                    onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, instructions: e.target.value } })}
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono whitespace-pre-wrap"
                    placeholder="编辑此智能体的系统提示词..." />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">可用工具（逗号分隔）</label>
                  <input type="text" value={Array.isArray(cfg.toolNames) ? cfg.toolNames.join(", ") : (cfg.toolNames || "")} 
                    onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, toolNames: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono" 
                    placeholder="searchWeb, readFile, runCommand..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">温度</label>
                    <input type="number" value={cfg.temperature ?? 0.5} min={0} max={2} step={0.1}
                      onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, temperature: parseFloat(e.target.value) ?? 0.5 } })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">首选模型</label>
                    <input type="text" value={cfg.preferredModel || ''}
                      onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, preferredModel: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
                      placeholder="gpt-5.5-thinking" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">最大步数</label>
                    <input type="number" value={cfg.maxSteps ?? 15} min={1} max={50}
                      onChange={(e) => setConfigs({ ...configs, [key]: { ...cfg, maxSteps: parseInt(e.target.value) || 15 } })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Auth Settings Panel ============
function AuthSettingsPanel() {
  const [authConfig, setAuthConfig] = useState({
    github_client_id: '', github_client_secret: '',
    google_client_id: '', google_client_secret: '',
    wechat_app_id: '', wechat_app_secret: '',
    sms_provider: 'aliyun',
    sms_access_key_id: '', sms_access_key_secret: '',
    sms_sign_name: '', sms_template_code: '', sms_app_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchAuthConfig(); }, []);

  const fetchAuthConfig = async () => {
    try {
      const keys = Object.keys(authConfig);
      const results = await Promise.all(keys.map(k => fetch(`/api/settings?key=${k}`).then(r => r.json())));
      const newConfig: Record<string, string> = {};
      keys.forEach((k, i) => { newConfig[k] = results[i]?.value || ''; });
      setAuthConfig(prev => ({ ...prev, ...newConfig }));
    } catch (e) { console.error(e); }
  };

  const saveAuthConfig = async () => {
    setLoading(true); setSaved(false);
    try {
      await Promise.all(
        Object.entries(authConfig).map(([key, value]) =>
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">第三方登录配置</h2>
        <button onClick={saveAuthConfig} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">
          <Save size={14} /> {loading ? '保存中...' : saved ? '已保存 ✓' : '保存配置'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">配置第三方 OAuth 登录和短信验证码服务。填写对应的 Key/Secret 后，登录页会自动显示对应登录按钮。</p>

      {/* GitHub OAuth */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-medium mb-3">GitHub 登录</h3>
        <p className="text-xs text-muted-foreground mb-3">
          在 <a href="https://github.com/settings/developers" target="_blank" className="text-primary hover:underline">GitHub Developer Settings</a> 创建 OAuth App，回调地址：<code className="text-xs bg-muted px-1 rounded">/api/auth/github</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-sm text-muted-foreground block mb-1">Client ID</label><input value={authConfig.github_client_id} onChange={(e) => setAuthConfig({...authConfig, github_client_id: e.target.value})} className={inputCls} placeholder="GitHub OAuth App Client ID" /></div>
          <div><label className="text-sm text-muted-foreground block mb-1">Client Secret</label><input type="password" value={authConfig.github_client_secret} onChange={(e) => setAuthConfig({...authConfig, github_client_secret: e.target.value})} className={inputCls} placeholder="GitHub OAuth App Client Secret" /></div>
        </div>
      </div>

      {/* Google OAuth */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-medium mb-3">Google 登录</h3>
        <p className="text-xs text-muted-foreground mb-3">
          在 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-primary hover:underline">Google Cloud Console</a> 创建 OAuth 2.0 凭据，回调地址：<code className="text-xs bg-muted px-1 rounded">/api/auth/google</code>，Scope：<code className="text-xs bg-muted px-1 rounded">openid email profile</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-sm text-muted-foreground block mb-1">Client ID</label><input value={authConfig.google_client_id} onChange={(e) => setAuthConfig({...authConfig, google_client_id: e.target.value})} className={inputCls} placeholder="Google OAuth Client ID" /></div>
          <div><label className="text-sm text-muted-foreground block mb-1">Client Secret</label><input type="password" value={authConfig.google_client_secret} onChange={(e) => setAuthConfig({...authConfig, google_client_secret: e.target.value})} className={inputCls} placeholder="Google OAuth Client Secret" /></div>
        </div>
      </div>

      {/* WeChat OAuth */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-medium mb-3">微信登录</h3>
        <p className="text-xs text-muted-foreground mb-3">
          在 <a href="https://open.weixin.qq.com/" target="_blank" className="text-primary hover:underline">微信开放平台</a> 创建网站应用，回调地址：<code className="text-xs bg-muted px-1 rounded">/api/auth/wechat</code>，Scope：<code className="text-xs bg-muted px-1 rounded">snsapi_login</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-sm text-muted-foreground block mb-1">AppID</label><input value={authConfig.wechat_app_id} onChange={(e) => setAuthConfig({...authConfig, wechat_app_id: e.target.value})} className={inputCls} placeholder="微信开放平台 AppID" /></div>
          <div><label className="text-sm text-muted-foreground block mb-1">AppSecret</label><input type="password" value={authConfig.wechat_app_secret} onChange={(e) => setAuthConfig({...authConfig, wechat_app_secret: e.target.value})} className={inputCls} placeholder="微信开放平台 AppSecret" /></div>
        </div>
      </div>

      {/* SMS Config */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-medium mb-3">短信验证码</h3>
        <p className="text-xs text-muted-foreground mb-3">
          阿里云：<a href="https://dysms.console.aliyun.com/" target="_blank" className="text-primary hover:underline">短信控制台</a> 申请签名和模板；
          腾讯云：<a href="https://console.cloud.tencent.com/smsv2" target="_blank" className="text-primary hover:underline">短信控制台</a> 创建应用。
        </p>
        <div className="space-y-3">
          <div><label className="text-sm text-muted-foreground block mb-1">短信服务商</label>
            <select value={authConfig.sms_provider} onChange={(e) => setAuthConfig({...authConfig, sms_provider: e.target.value})} className={inputCls}>
              <option value="aliyun">阿里云</option><option value="tencent">腾讯云</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground block mb-1">{authConfig.sms_provider === 'tencent' ? 'SecretId' : 'AccessKey ID'}</label><input value={authConfig.sms_access_key_id} onChange={(e) => setAuthConfig({...authConfig, sms_access_key_id: e.target.value})} className={inputCls} /></div>
            <div><label className="text-sm text-muted-foreground block mb-1">{authConfig.sms_provider === 'tencent' ? 'SecretKey' : 'AccessKey Secret'}</label><input type="password" value={authConfig.sms_access_key_secret} onChange={(e) => setAuthConfig({...authConfig, sms_access_key_secret: e.target.value})} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground block mb-1">短信签名</label><input value={authConfig.sms_sign_name} onChange={(e) => setAuthConfig({...authConfig, sms_sign_name: e.target.value})} className={inputCls} placeholder="已审核通过的签名" /></div>
            <div><label className="text-sm text-muted-foreground block mb-1">模板 Code</label><input value={authConfig.sms_template_code} onChange={(e) => setAuthConfig({...authConfig, sms_template_code: e.target.value})} className={inputCls} placeholder={authConfig.sms_provider === 'tencent' ? '模板 ID' : 'SMS_XXXXXX'} /></div>
          </div>
          {authConfig.sms_provider === 'tencent' && (
            <div><label className="text-sm text-muted-foreground block mb-1">SdkAppId</label><input value={authConfig.sms_app_id} onChange={(e) => setAuthConfig({...authConfig, sms_app_id: e.target.value})} className={inputCls} placeholder="如 1400006666" /></div>
          )}
        </div>
      </div>
    </div>
  );
}


interface Project { id: string; name: string; description?: string; created_at?: string; createdAt: string; updated_at?: string; updatedAt: string; _count?: { files: number; conversations: number }; }
function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
      } else if (data.data) {
        setProjects(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreate = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ name: '', description: '' });
      setShowForm(false);
      await fetchProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？相关文件和对话记录都将被删除！')) return;
    try {
      await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      await fetchProjects();
      if (selectedProject?.id === id) setSelectedProject(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">项目管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          <Plus size={14} /> 新建项目
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <input
            placeholder="项目名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="项目描述（可选）"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !form.name}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={14} /> 创建
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div key={project.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-medium">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedProject(project)}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                  title="查看详情"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="删除项目"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <File size={12} /> {project._count?.files || 0} 文件
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare size={12} /> {project._count?.conversations || 0} 对话
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {new Date(project.updatedAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <Folder size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无项目</p>
          <p className="text-sm mt-2">点击"新建项目"创建第一个项目</p>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedProject(null)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedProject.name}</h3>
              <button onClick={() => setSelectedProject(null)} className="p-1 hover:bg-accent rounded">✕</button>
            </div>
            {selectedProject.description && (
              <p className="text-sm text-muted-foreground mb-4">{selectedProject.description}</p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">文件数量</span>
                <span className="font-medium">{selectedProject._count?.files || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">对话数量</span>
                <span className="font-medium">{selectedProject._count?.conversations || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">创建时间</span>
                <span className="text-sm">{new Date(selectedProject.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">更新时间</span>
                <span className="text-sm">{new Date(selectedProject.updatedAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/workspace/${selectedProject.id}`}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm text-center hover:bg-primary/90"
              >
                打开项目
              </Link>
              <button
                onClick={() => { handleDelete(selectedProject.id); setSelectedProject(null); }}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Account Panel ============
function AccountPanel() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentUsername, setCurrentUsername] = useState('admin');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCurrentUsername();
  }, []);

  const fetchCurrentUsername = async () => {
    try {
      const res = await fetch('/api/admin/password');
      if (res.ok) {
        const data = await res.json();
        setCurrentUsername(data.username || 'admin');
      }
    } catch (err) {
      console.error('Failed to fetch username:', err);
    }
  };

  const handleChange = async () => {
    setMessage('');
    setError('');

    if (!currentPassword) {
      setError('请输入当前密码');
      return;
    }

    if (!newUsername && !newPassword) {
      setError('请至少填写要修改的用户名或新密码');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('新密码至少需要6个字符');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_username: newUsername || undefined,
          new_password: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('保存成功！');
        setCurrentPassword('');
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
        if (newUsername) setCurrentUsername(newUsername);
      } else {
        setError(data.error || '保存失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">账号设置</h2>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-md">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">当前用户名</label>
          <div className="px-3 py-2 rounded-lg bg-muted text-sm">{currentUsername}</div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">当前密码</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="请输入当前密码"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">新用户名（留空则不修改）</label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="输入新用户名"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">新密码（留空则不修改，至少6位）</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="输入新密码"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
        </div>

        {newPassword && (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        {message && <p className="text-sm text-green-500">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleChange}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
