'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Key, Settings, MessageSquare, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import type { ModelConfig, ApiKey, Conversation } from '@/lib/types';

type Tab = 'keys' | 'models' | 'conversations';

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
        <div className="flex gap-2 mb-6 border-b border-border pb-4">
          <TabButton icon={<Key size={16} />} label="API 密钥" active={activeTab === 'keys'} onClick={() => setActiveTab('keys')} />
          <TabButton icon={<Settings size={16} />} label="模型配置" active={activeTab === 'models'} onClick={() => setActiveTab('models')} />
          <TabButton icon={<MessageSquare size={16} />} label="对话记录" active={activeTab === 'conversations'} onClick={() => setActiveTab('conversations')} />
        </div>

        {activeTab === 'keys' && <ApiKeysPanel />}
        {activeTab === 'models' && <ModelsPanel />}
        {activeTab === 'conversations' && <ConversationsPanel />}
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
// 厂商列表
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
          {/* 厂商选择下拉框 */}
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
  const [form, setForm] = useState({
    model_id: '', display_name: '', provider: 'coze', description: '',
    default_temperature: '0.7', default_max_tokens: 4096, sort_order: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    const res = await fetch('/api/models');
    const data = await res.json();
    if (data.data) setModels(data.data);
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
      setForm({ model_id: '', display_name: '', provider: 'coze', description: '', default_temperature: '0.7', default_max_tokens: 4096, sort_order: 0 });
      setShowForm(false);
      await fetchModels();
    } finally {
      setLoading(false);
    }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">模型配置</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchModels}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent"
          >
            <RefreshCw size={14} /> 刷新
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
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
          <div className="grid grid-cols-3 gap-3">
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
          </div>
          <input
            placeholder="模型描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={14} /> 保存
          </button>
        </div>
      )}

      <div className="space-y-2">
        {models.map((model) => (
          <div key={model.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
            <div className="flex-1">
              <div className="flex items-center gap-2">
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
                onClick={() => handleToggleEnabled(model)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  model.is_enabled
                    ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                    : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                }`}
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

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    if (data.data) setConversations(data.data);
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
          onClick={fetchConversations}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent"
        >
          <RefreshCw size={14} /> 刷新
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
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
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
