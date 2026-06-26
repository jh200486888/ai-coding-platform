"use client";
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

interface McpServer {
  id: string;
  name: string;
  url: string;
  type: 'http' | 'sse';
  enabled: boolean;
  headers?: Record<string, string>;
}

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState<McpServer>({ id: '', name: '', url: '', type: 'http', enabled: true });
  const [editing, setEditing] = useState(false);

  useEffect(() => { fetchServers(); }, []);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/admin/mcp-servers');
      const data = await res.json();
      if (data.success) setServers(data.data || []);
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let updated = [...servers];
      if (editing) {
        const idx = updated.findIndex(s => s.id === editForm.id);
        if (idx >= 0) updated[idx] = editForm;
      } else {
        updated.push({ ...editForm, id: 'mcp_' + Date.now() });
      }
      await fetch('/api/admin/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: updated }),
      });
      setServers(updated);
      setEditForm({ id: '', name: '', url: '', type: 'http', enabled: true });
      setEditing(false);
      toast.success('保存成功');
    } catch (err) { toast.error('保存失败'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此MCP服务器？')) return;
    const updated = servers.filter(s => s.id !== id);
    await fetch('/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servers: updated }),
    });
    setServers(updated);
  };

  const toggleEnabled = async (id: string) => {
    const updated = servers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    await fetch('/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servers: updated }),
    });
    setServers(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">MCP 服务器管理</h2>
        <button onClick={() => { setEditForm({ id: '', name: '', url: '', type: 'http', enabled: true }); setEditing(false); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">
          <Plus size={14} /> 添加服务器
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h3 className="font-medium mb-3">{editing ? '编辑' : '新增'} MCP 服务器</h3>
        <div className="grid grid-cols-2 gap-3">
          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" placeholder="名称" />
          <input value={editForm.url} onChange={e => setEditForm({ ...editForm, url: e.target.value })}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" placeholder="URL (http://...)" />
          <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="http">HTTP</option>
            <option value="sse">SSE</option>
          </select>
        </div>
        <button onClick={handleSave} disabled={loading || !editForm.name || !editForm.url}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
          <Save size={14} /> {loading ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="space-y-2">
        {servers.map(s => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-medium flex items-center gap-2">
                {s.name}
                <span className={`text-xs px-2 py-0.5 rounded ${s.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {s.enabled ? '启用' : '禁用'}
                </span>
                <span className="text-xs text-muted-foreground">{s.type}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{s.url}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleEnabled(s.id)} className="p-2 rounded-lg hover:bg-accent">
                {s.enabled ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              </button>
              <button onClick={() => { setEditForm(s); setEditing(true); }} className="p-2 rounded-lg hover:bg-accent text-sm">编辑</button>
              <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg hover:bg-accent text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {servers.length === 0 && <p className="text-center text-muted-foreground py-8">暂无MCP服务器配置</p>}
      </div>
    </div>
  );
}
