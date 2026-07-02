"use client";
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ToggleLeft, ToggleRight, Edit2, Server, Cpu } from 'lucide-react';

interface McpServer {
  id: string;
  name: string;
  url?: string;
  type: 'http' | 'sse' | 'stdio';
  enabled: boolean;
  apiKey?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

const emptyForm: McpServer = {
  id: '', name: '', url: '', type: 'http', enabled: true, apiKey: '',
  command: '', args: [], env: {},
};

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState<McpServer>({ ...emptyForm });
  const [editing, setEditing] = useState(false);
  const [envInput, setEnvInput] = useState('');

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
      const server: McpServer = { ...editForm };
      if (server.type === 'http' || server.type === 'sse') {
        server.headers = server.apiKey ? { 'X-API-Key': server.apiKey } : undefined;
        delete server.command; delete server.args; delete server.env;
      } else if (server.type === 'stdio') {
        server.args = server.command ? server.command.split(' ').slice(1) : [];
        const cmd = server.command ? server.command.split(' ')[0] : '';
        server.command = cmd;
        // Parse env input (KEY=VALUE per line)
        const envObj: Record<string, string> = {};
        envInput.split('\n').forEach(line => {
          const eq = line.indexOf('=');
          if (eq > 0) envObj[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
        });
        server.env = Object.keys(envObj).length > 0 ? envObj : undefined;
        delete server.url; delete server.apiKey; delete server.headers;
      }
      if (editing) {
        const idx = updated.findIndex(s => s.id === editForm.id);
        if (idx >= 0) updated[idx] = server;
      } else {
        updated.push({ ...server, id: 'mcp_' + Date.now() });
      }
      await fetch('/api/admin/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: updated }),
      });
      setServers(updated);
      setEditForm({ ...emptyForm });
      setEnvInput('');
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

  const startEdit = (s: McpServer) => {
    setEditForm({ ...s });
    // Reconstruct env input from env object
    if (s.env) {
      setEnvInput(Object.entries(s.env).map(([k, v]) => k + '=' + v).join('\n'));
    } else {
      setEnvInput('');
    }
    setEditing(true);
  };

  const isStdio = editForm.type === 'stdio';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">MCP 服务器管理</h2>
        <button onClick={() => { setEditForm({ ...emptyForm }); setEnvInput(''); setEditing(false); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">
          <Plus size={14} /> 添加服务器
        </button>
      </div>

      {/* Edit/Add Form */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h3 className="font-medium mb-3">{editing ? '编辑' : '新增'} MCP 服务器</h3>
        <div className="grid grid-cols-2 gap-3">
          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" placeholder="名称（如 comfy, thinking）" />
          <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="http">HTTP（远程）</option>
            <option value="sse">SSE（远程）</option>
            <option value="stdio">Stdio（本地进程）</option>
          </select>

          {!isStdio ? (
            <>
              <input value={editForm.url || ''} onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary col-span-2" placeholder="URL（https://...）" />
              <input value={editForm.apiKey || ''} onChange={e => setEditForm({ ...editForm, apiKey: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary col-span-2" placeholder="API Key（可选）" />
            </>
          ) : (
            <>
              <input value={editForm.command || ''} onChange={e => setEditForm({ ...editForm, command: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary col-span-2"
                placeholder="启动命令（如 /path/to/node dist/index.js 或 npx @modelcontextprotocol/server-xxx）" />
              <textarea value={envInput} onChange={e => setEnvInput(e.target.value)}
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary col-span-2 font-mono"
                rows={3} placeholder="环境变量（每行一个 KEY=VALUE，可选）" />
            </>
          )}
        </div>
        <button onClick={handleSave} disabled={loading || !editForm.name || (!isStdio && !editForm.url) || (isStdio && !editForm.command)}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
          <Save size={14} /> {loading ? '保存中...' : '保存'}
        </button>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {servers.map(s => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {s.type === 'stdio' ? <Cpu size={14} className="text-blue-400" /> : <Server size={14} className="text-green-400" />}
                {s.name}
                <span className={`text-xs px-2 py-0.5 rounded ${s.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {s.enabled ? '启用' : '禁用'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground">{s.type}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {s.type === 'stdio' ? (s.command + ' ' + (s.args || []).join(' ')) : s.url}
              </div>
              {s.apiKey && <div className="text-xs text-muted-foreground mt-0.5">Key: {s.apiKey.slice(0, 8)}...{s.apiKey.slice(-4)}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleEnabled(s.id)} className="p-2 rounded-lg hover:bg-accent">
                {s.enabled ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              </button>
              <button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-accent text-sm">
                <Edit2 size={16} />
              </button>
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
