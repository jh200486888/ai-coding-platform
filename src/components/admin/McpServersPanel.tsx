"use client";

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Server, ToggleLeft, ToggleRight } from 'lucide-react';

interface McpServer {
  id: string;
  name: string;
  url: string;
  type: 'http' | 'sse';
  enabled: boolean;
}

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', type: 'http' as 'http' | 'sse', enabled: true });

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/admin/mcp-servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', url: '', type: 'http', enabled: true });
        await fetchServers();
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    if (!formData.name || !formData.url) return;
    const newServer: McpServer = {
      id: `server-${Date.now()}`,
      name: formData.name,
      url: formData.url,
      type: formData.type,
      enabled: formData.enabled,
    };
    setServers([...servers, newServer]);
    setShowForm(false);
    setFormData({ name: '', url: '', type: 'http', enabled: true });
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这个服务器吗？')) return;
    setServers(servers.filter(s => s.id !== id));
  };

  const handleToggle = (id: string) => {
    setServers(servers.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleEditSave = (id: string, field: keyof McpServer, value: any) => {
    setServers(servers.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Server className="w-5 h-5" />
          MCP 服务器管理
        </h2>
        <div className="flex gap-2">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              添加服务器
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存全部'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium">添加新服务器</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="服务器名称"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">URL</label>
              <input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="http://example.com/mcp"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">类型</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'http' | 'sse' })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
              >
                <option value="http">HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">启用</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!formData.name || !formData.url}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              添加
            </button>
            <button
              onClick={() => { setShowForm(false); setFormData({ name: '', url: '', type: 'http', enabled: true }); }}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {servers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无 MCP 服务器配置</p>
          <p className="text-sm mt-2">点击"添加服务器"创建第一个配置</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div
              key={server.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">名称</div>
                  {editingId === server.id ? (
                    <input
                      type="text"
                      defaultValue={server.name}
                      onBlur={(e) => handleEditSave(server.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 bg-background border border-border rounded text-sm mt-1"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                    />
                  ) : (
                    <div className="font-medium mt-1">{server.name}</div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm text-muted-foreground">URL</div>
                  {editingId === server.id ? (
                    <input
                      type="text"
                      defaultValue={server.url}
                      onBlur={(e) => handleEditSave(server.id, 'url', e.target.value)}
                      className="w-full px-2 py-1 bg-background border border-border rounded text-sm mt-1"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground truncate mt-1">{server.url}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">类型</div>
                  <select
                    value={server.type}
                    onChange={(e) => handleEditSave(server.id, 'type', e.target.value)}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm mt-1"
                  >
                    <option value="http">HTTP</option>
                    <option value="sse">SSE</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleToggle(server.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    server.enabled
                      ? 'text-green-500 hover:bg-green-500/10'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  title={server.enabled ? '已启用' : '已禁用'}
                >
                  {server.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => handleEdit(server.id)}
                  className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
