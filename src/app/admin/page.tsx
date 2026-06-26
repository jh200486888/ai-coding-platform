'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Key, Settings, MessageSquare, Plus, Trash2, Save, RefreshCw, Upload, Folder, File, Eye, Lock, Palette, Activity, Plug, Brain } from 'lucide-react';
import { ImageGenPanel } from "@/components/admin/ImageGenPanel";
import { TelemetryPanel } from "@/components/admin/TelemetryPanel";
import { McpServersPanel } from "@/components/admin/McpServersPanel";
import { MemoryPanel } from "@/components/admin/MemoryPanel";
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import type { ModelConfig, ApiKey, Conversation } from '@/lib/types';

// 从 models.ts 导入的模型数据
const MODELS_DATA = [
  { id: 'gpt-5.6', name: 'GPT-5.6', provider: 'openai', description: '最新旗舰，150万Token上下文' },
  { id: 'gpt-5.6-mini', name: 'GPT-5.6 Mini', provider: 'openai', description: '轻量版，高性价比' },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', description: '上一代旗舰' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', description: '稳定版本' },
  { id: 'o3', name: 'o3', provider: 'openai', description: '推理模型' },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', description: '轻量推理模型' },
  { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'openai-image', description: '图片生成模型' },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'anthropic', description: '最强旗舰模型' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', description: '均衡性能主力' },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'anthropic', description: '快速响应版' },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'anthropic', description: '上一代旗舰' },
  { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro', provider: 'google', description: '最新Pro旗舰' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', description: '极速版 284token/s' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'google', description: '上一代Pro' },
  { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash', provider: 'google', description: '上一代极速版' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', description: '1.6T参数开源旗舰' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', description: '284B参数高效版' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', description: '推理增强模型' },
  { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash', provider: 'zhipu', description: '免费极速版' },
  { id: 'glm-4-flash', name: 'GLM-4 Flash', provider: 'zhipu', description: '免费轻量版' },
  { id: 'glm-5.2', name: 'GLM-5.2', provider: 'zhipu', description: '最新旗舰(需充值)' },
  { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen', description: '通义千问旗舰' },
  { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen', description: '增强版' },
  { id: 'qwen-turbo', name: 'Qwen Turbo', provider: 'qwen', description: '快速版' },
  { id: 'qwen-long', name: 'Qwen Long', provider: 'qwen', description: '超长上下文' },
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: 'moonshot', description: '代码智能体旗舰' },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', provider: 'moonshot', description: '长文档处理' },
  { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', provider: 'moonshot', description: '经典长上下文' },
  { id: 'ernie-5.1', name: 'ERNIE 5.1', provider: 'baidu', description: '文心最新版' },
  { id: 'ernie-5.0', name: 'ERNIE 5.0', provider: 'baidu', description: '文心5.0' },
  { id: 'doubao-pro-256k', name: '豆包 Pro 256K', provider: 'doubao', description: '长上下文版' },
  { id: 'doubao-lite-32k', name: '豆包 Lite 32K', provider: 'doubao', description: '轻量版' },
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'groq', description: 'Meta最新模型' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'groq', description: '轻量版' },
  { id: 'mistral-large-2', name: 'Mistral Large 2', provider: 'mistral', description: '旗舰模型' },
  { id: 'mistral-small-3', name: 'Mistral Small 3', provider: 'mistral', description: '轻量版' },
  { id: 'grok-3', name: 'Grok 3', provider: 'xai', description: 'xAI旗舰' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xai', description: '轻量版' },
  { id: 'command-r-plus', name: 'Command R+', provider: 'cohere', description: '企业级模型' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', provider: 'banana', description: '轻量极速模型' },
];

type Tab = 'keys' | 'models' | 'conversations' | 'settings' | 'projects' | 'account' | 'imagegen' | 'telemetry' | 'mcp' | 'memory';

export default function AdminPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('models');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium">
              <ArrowLeft size={16} /> 返回首页
            </Link>
            <h1 className="text-xl font-bold">后台管理</h1>
          </div>
          <button
            onClick={async () => { await fetch('/api/admin/login', { method: 'DELETE' }); window.location.href = '/admin/login'; }}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 border-b border-border pb-4 flex-wrap">
          <TabButton icon={<Key size={16} />} label="API 密钥" active={activeTab === 'keys'} onClick={() => setActiveTab('keys')} />
          <TabButton icon={<Settings size={16} />} label="模型配置" active={activeTab === 'models'} onClick={() => setActiveTab('models')} />
          <TabButton icon={<MessageSquare size={16} />} label="对话记录" active={activeTab === 'conversations'} onClick={() => setActiveTab('conversations')} />
          <TabButton icon={<Settings size={16} />} label="系统设置" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <TabButton icon={<Folder size={16} />} label="项目管理" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
          <TabButton icon={<Lock size={16} />} label="账号设置" active={activeTab === 'account'} onClick={() => setActiveTab('account')} />
          <TabButton icon={<Palette size={16} />} label="图片生成" active={activeTab === 'imagegen'} onClick={() => setActiveTab('imagegen')} />
          <TabButton icon={<Activity size={16} />} label="AI 监控" active={activeTab === 'telemetry'} onClick={() => setActiveTab('telemetry')} />
          <TabButton icon={<Plug size={16} />} label="MCP 服务器" active={activeTab === 'mcp'} onClick={() => setActiveTab('mcp')} />
          <TabButton icon={<Brain size={16} />} label="记忆管理" active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} />
        </div>

        {activeTab === 'keys' && <ApiKeysPanel />}
        {activeTab === 'models' && <ModelsPanel />}
        {activeTab === 'conversations' && <ConversationsPanel />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'projects' && <ProjectsPanel />}
        {activeTab === 'account' && <AccountPanel />}
        {activeTab === 'imagegen' && <ImageGenPanel />}
        {activeTab === 'telemetry' && <TelemetryPanel />}
        {activeTab === 'mcp' && <McpServersPanel />}
        {activeTab === 'memory' && <MemoryPanel />}
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ============ API Keys Panel ============
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
];

function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: '', provider_name: '', api_key: '', base_url: '' });
  const [loading, setLoading] = useState(false);
  const [searchProvider, setSearchProvider] = useState('');

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
    await fetch(`/api/admin/keys?id=${id}`, { method: 'DELETE' });
    await fetchKeys();
  };

  const handleSelectProvider = (providerId: string) => {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setForm({ ...form, provider: provider.id, provider_name: provider.name });
    }
  };

  const filteredProviders = PROVIDERS.filter(p => 
    p.id.toLowerCase().includes(searchProvider.toLowerCase()) ||
    p.name.toLowerCase().includes(searchProvider.toLowerCase()) ||
    p.desc.toLowerCase().includes(searchProvider.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
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

      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
            <div>
              <div className="font-medium">{key.provider_name}</div>
              <div className="text-sm text-muted-foreground">{key.api_key_encrypted}</div>
              {key.base_url && <div className="text-xs text-muted-foreground mt-1">{key.base_url}</div>}
            </div>
            <button
              onClick={() => handleDelete(key.id)}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={16} />
            </button>
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
      if (showFeedback) alert("模型列表已刷新");
    } catch (err) {
      console.error("Failed to fetch models:", err);
      if (showFeedback) alert("刷新失败：" + (err instanceof Error ? err.message : "未知错误"));
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
      alert(`成功导入 ${MODELS_DATA.length} 个模型！`);
    } catch (err) {
      console.error('Import error:', err);
      alert('导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">模型配置</h2>
        <div className="flex gap-2">
          <button
            onClick={() => fetchModels(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "刷新中..." : "刷新"}
          </button>
          <button
            onClick={handleBatchImport}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Upload size={14} /> {importing ? '导入中...' : '批量导入'}
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditingModel(null); setForm({ model_id: '', display_name: '', provider: 'openai', description: '', default_temperature: '0.7', default_max_tokens: 4096, sort_order: 0 }); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
          >
            <Plus size={14} /> 添加模型
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-4 gap-3">
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
          <div key={model.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(model)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
              >
                编辑
              </button>
              <button
                onClick={() => handleToggleEnabled(model)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${model.is_enabled ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
              >
                {model.is_enabled ? '禁用' : '启用'}
              </button>
              <button
                onClick={() => handleDelete(model.id)}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={16} />
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


  const fetchConversations = useCallback(async (showFeedback: boolean = false) => {
    if (showFeedback) setConvRefreshing(true);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.data) setConversations(data.data);
      if (showFeedback) alert("对话记录已刷新");
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      if (showFeedback) alert("刷新失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      if (showFeedback) setConvRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">对话记录</h2>
        <button
          onClick={() => fetchConversations(true)}
          disabled={convRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw size={14} className={convRefreshing ? "animate-spin" : ""} /> {convRefreshing ? "刷新中..." : "刷新"}
        </button>
      </div>

      <div className="space-y-2">
        {conversations.map((conv) => (
          <div key={conv.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => loadMessages(conv.id)}
            >
              <div>
                <div className="font-medium">{conv.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {conv.model_id} - {new Date(conv.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
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
        {conversations.length === 0 && (
          <div className="text-center text-muted-foreground py-8">No conversations yet</div>
        )}
      </div>
    </div>
  );
}

// ============ Settings Panel ============
function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    system_prompt: '',
    site_title: '',
    site_description: '',
    default_model: '',
  });
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<{id: string; name: string}[]>([]);

  const [modeTemps, setModeTemps] = useState({ coding: 0, writing: 0.7, analysis: 0.1, design: 0.3, chat: 0.5 });
  const [modePrompts, setModePrompts] = useState({
    writing: '\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u6587\u6848\u5199\u4f5c\u52a9\u624b\u3002\n\u3010\u89c4\u5219\u3011\u76f4\u63a5\u7ed9\u5185\u5bb9\uff0c\u4e0d\u7528Markdown\u3002\u6839\u636e\u573a\u666f\u8c03\u6574\u8bed\u6c14\u3002\u6ca1\u6307\u5b9a\u98ce\u683c\u7ed92-3\u4e2a\u7248\u672c\u3002\u5b8c\u6210\u540e1-2\u53e5\u603b\u7ed3\u3002',
    analysis: '\u4f60\u662f\u6570\u636e\u5206\u6790\u4e0e\u7b56\u7565\u987e\u95ee\u3002\n\u3010\u89c4\u5219\u3011\u5148\u7ed3\u8bba\u540e\u5c55\u5f00\u3002\u4e0d\u7528Markdown\u3002\u6ce8\u660e\u6765\u6e90\u3002\u4e0d\u786e\u5b9a\u5c31\u8bf4\u660e\u3002\u5b8c\u6210\u540e\u603b\u7ed3\u6838\u5fc3\u7ed3\u8bba\u3002',
    design: '\u4f60\u662fUI/UX\u8bbe\u8ba1\u987e\u95ee\u3002\n\u3010\u89c4\u5219\u3011\u7ed9\u5177\u4f53\u6570\u503c\u3002\u4e0d\u7528Markdown\u3002\u7ed9\u5b8c\u6574\u65b9\u6848\u4e0d\u9010\u6b65\u8ffd\u95ee\u3002\u5b8c\u6210\u540e\u603b\u7ed3\u8981\u70b9\u3002',
    chat: '\u4f60\u662f\u667a\u80fd\u52a9\u624b\u3002\n\u3010\u89c4\u5219\u3011\u7b80\u6d01\u81ea\u7136\u3002\u4e0d\u7528Markdown\u3002\u4e0d\u7f16\u9020\u3002\u957f\u56de\u7b54\u6700\u540e1\u53e5\u603b\u7ed3\u3002',
  });
  const [advConfig, setAdvConfig] = useState({
    max_steps: 15,
    max_retries: 3,
    tool_timeout_seconds: 120,
    memory_context_limit: 30,
    auto_memory_extract: true,
    sub_agent_models: 'deepseek-v4-flash,glm-5-turbo,qwen-3.7-flash',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModeTemps, setShowModeTemps] = useState(false);
  const [showModePrompts, setShowModePrompts] = useState(false);

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
          site_title: data.data.site_title || '',
          site_description: data.data.site_description || '',
          default_model: data.data.default_model || '',
        });
        try { if (data.data.mode_temperatures) setModeTemps(JSON.parse(data.data.mode_temperatures)); } catch {}
        try { if (data.data.mode_prompts) setModePrompts(JSON.parse(data.data.mode_prompts)); } catch {}
        try { if (data.data.advanced_config) { const adv = JSON.parse(data.data.advanced_config); setAdvConfig(prev => ({ ...prev, ...adv })); } } catch {}
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
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'site_title', value: form.site_title }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'site_description', value: form.site_description }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'default_model', value: form.default_model }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'mode_temperatures', value: JSON.stringify(modeTemps) }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'mode_prompts', value: JSON.stringify(modePrompts) }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'advanced_config', value: JSON.stringify(advConfig) }) }),
      ]);
      alert('\u8bbe\u7f6e\u5df2\u4fdd\u5b58\uff01');
      fetchSettings();
    } catch (err) { console.error('Failed to save settings:', err); alert('\u4fdd\u5b58\u5931\u8d25'); }
    finally { setLoading(false); }
  };

  const modeLabels: Record<string, string> = { coding: '\u7f16\u7a0b', writing: '\u5199\u4f5c', analysis: '\u5206\u6790', design: '\u8bbe\u8ba1', chat: '\u804a\u5929' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{'\u7cfb\u7edf\u8bbe\u7f6e'}</h2>
        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
          <Save size={14} /> {loading ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58\u8bbe\u7f6e'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-medium mb-3">{'\u7cfb\u7edf\u63d0\u793a\u8bcd (System Prompt)'}</h3>
          <p className="text-xs text-muted-foreground mb-3">{'\u8bbe\u7f6e AI \u7684\u7cfb\u7edf\u63d0\u793a\u8bcd\uff0c\u5f71\u54cd\u7f16\u7a0b\u6a21\u5f0f\u7684\u5bf9\u8bdd\u3002'}</p>
          <textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={8}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono" placeholder={''} />
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
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

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-medium mb-3">{'\u9ed8\u8ba4\u6a21\u578b'}</h3>
          <select value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="">-- {'\u9009\u62e9\u9ed8\u8ba4\u6a21\u578b'} --</option>
            {models.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
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

        <div className="bg-card border border-border rounded-xl p-4">
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
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{'\u9ad8\u7ea7\u53c2\u6570\u914d\u7f6e'}</h3>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-primary hover:underline">
              {showAdvanced ? '\u6536\u8d77' : '\u5c55\u5f00'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{'\u8c03\u6574\u5de5\u5177\u6267\u884c\u3001\u8bb0\u5fc6\u7cfb\u7edf\u7b49\u9ad8\u7ea7\u53c2\u6570\u3002\u4e00\u822c\u4f7f\u7528\u9ed8\u8ba4\u503c\u5373\u53ef\u3002'}</p>
          {showAdvanced && (
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
                    onChange={(e) => setAdvConfig({ ...advConfig, max_steps: parseInt(e.target.value) || 15 })}
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
              </div>
            </div>
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
