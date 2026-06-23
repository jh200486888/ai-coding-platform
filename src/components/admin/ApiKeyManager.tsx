'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import type { ApiKey } from '@/types';
import { PROVIDERS } from '@/lib/models';

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState({ provider: 'openai', apiKey: '', name: '' });

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    const response = await fetch('/api/api-keys');
    if (response.ok) {
      const data = await response.json();
      setApiKeys(data);
    }
  };

  const handleAdd = async () => {
    const response = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newKey),
    });
    if (response.ok) {
      setShowForm(false);
      setNewKey({ provider: 'openai', apiKey: '', name: '' });
      fetchApiKeys();
    }
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/api-keys?id=${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchApiKeys();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">API Key 管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      {showForm && (
        <div className="bg-muted p-4 rounded-lg space-y-3">
          <div>
            <label className="text-sm font-medium">厂商</label>
            <select
              value={newKey.provider}
              onChange={e => setNewKey({ ...newKey, provider: e.target.value })}
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">名称</label>
            <input
              type="text"
              value={newKey.name}
              onChange={e => setNewKey({ ...newKey, name: e.target.value })}
              placeholder="例如：我的 OpenAI Key"
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">API Key</label>
            <input
              type="password"
              value={newKey.apiKey}
              onChange={e => setNewKey({ ...newKey, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm"
            >
              保存
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-muted text-foreground rounded text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>暂无 API Key</p>
          </div>
        ) : (
          apiKeys.map(key => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div>
                <div className="font-medium">{key.name || PROVIDERS[key.provider]}</div>
                <div className="text-sm text-muted-foreground">
                  {PROVIDERS[key.provider]} • {key.apiKey.slice(0, 8)}...
                </div>
              </div>
              <button
                onClick={() => handleDelete(key.id)}
                className="p-2 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
