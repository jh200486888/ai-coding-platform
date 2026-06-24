'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { getAllProviders } from '@/lib/ai-providers';

interface ApiKeyRecord {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  isActive: boolean;
  createdAt: string;
}

function decodeBase64(str: string): string {
  try { return atob(str); } catch { return str; }
}
function encodeBase64(str: string): string {
  try { return btoa(str); } catch { return str; }
}

export function ModelManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState({ provider: 'deepseek', apiKey: '' });
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const providers = getAllProviders();

  useEffect(() => { fetchApiKeys(); }, []);

  const fetchApiKeys = async () => {
    const response = await fetch('/api/api-keys');
    if (response.ok) {
      const data = await response.json();
      setApiKeys(data);
    }
  };

  const handleAdd = async () => {
    if (!newKey.apiKey) {
      alert('请填写 API Key');
      return;
    }

    const providerName = providers.find(p => p.id === newKey.provider)?.name || newKey.provider;

    const response = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: newKey.provider,
        name: providerName,
        apiKey: newKey.apiKey,
        isActive: true,
      }),
    });

    if (response.ok) {
      setShowForm(false);
      setNewKey({ provider: 'deepseek', apiKey: '' });
      fetchApiKeys();
    } else {
      const data = await response.json();
      alert(data.error || '添加失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个 API Key 吗？')) return;
    const response = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
    if (response.ok) fetchApiKeys();
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || id;

  const maskKey = (key: string) => {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  const groupedKeys = apiKeys.reduce((acc, key) => {
    if (!acc[key.provider]) acc[key.provider] = [];
    acc[key.provider].push(key);
    return acc;
  }, {} as Record<string, ApiKeyRecord[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">API Key 管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加 Key
        </button>
      </div>

      <p className="text-sm text-zinc-400">
        选择厂商并填写对应的 API Key 即可。模型列表自动维护，无需手动添加。
      </p>

      {showForm && (
        <div className="p-4 bg-zinc-800 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">厂商</label>
              <select
                value={newKey.provider}
                onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">API Key</label>
              <input
                type="password"
                value={newKey.apiKey}
                onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              保存
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(groupedKeys).map(([provider, keys]) => (
          <div key={provider} className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Key className="w-4 h-4" />
              {getProviderName(provider)}
            </h3>
            {keys.map((key) => {
              const decoded = decodeBase64(key.apiKey);
              const isVisible = visibleKeys.has(key.id);
              return (
                <div key={key.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-white">
                      {isVisible ? decoded : maskKey(decoded)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className={`px-2 py-1 text-xs rounded ${key.isActive ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                      {key.isActive ? '启用' : '禁用'}
                    </span>
                    <button onClick={() => toggleKeyVisibility(key.id)} className="p-2 text-zinc-400 hover:bg-zinc-700 rounded-lg transition-colors">
                      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(key.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {apiKeys.length === 0 && (
          <div className="text-center py-8 text-zinc-500">暂无 API Key，请先添加</div>
        )}
      </div>
    </div>
  );
}
