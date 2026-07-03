'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';

interface ContextItem {
  id: string;
  project_key: string;
  context_type: string;
  title: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CONTEXT_TYPES = [
  { value: 'system_prompt', label: '系统指令' },
  { value: 'coding_rules', label: '编码规范' },
  { value: 'project_info', label: '项目信息' },
  { value: 'user_preferences', label: '用户偏好' },
  { value: 'tech_stack', label: '技术栈' },
];

export default function ProjectContextPanel() {
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('system_prompt');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchContexts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/project-contexts?project_key=default');
      const data = await res.json();
      setContexts(data);
    } catch (e) {
      console.error('Failed to fetch contexts', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContexts(); }, [fetchContexts]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/project-contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          project_key: 'default',
          context_type: 'system_prompt',
          title: '新上下文',
          content: '',
          sort_order: contexts.length,
        }),
      });
      await fetchContexts();
      setMessage('已创建');
      setTimeout(() => setMessage(''), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      await fetch('/api/admin/project-contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id,
          title: editTitle,
          content: editContent,
          context_type: editType,
        }),
      });
      setEditing(null);
      await fetchContexts();
      setMessage('已保存');
      setTimeout(() => setMessage(''), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch('/api/admin/project-contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id, is_active: !isActive }),
    });
    await fetchContexts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此上下文？')) return;
    await fetch('/api/admin/project-contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    await fetchContexts();
    setMessage('已删除');
    setTimeout(() => setMessage(''), 2000);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">项目上下文配置</h3>
          <p className="text-xs text-muted-foreground mt-1">
            定义在每次对话开始时自动注入到系统提示中的上下文信息。包括编码规范、项目信息、技术栈说明等。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-green-600">{message}</span>}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} /> 新增上下文
          </button>
        </div>
      </div>

      {contexts.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
          暂无上下文配置，点击「新增上下文」添加
        </div>
      ) : (
        <div className="space-y-3">
          {contexts.map((ctx) => (
            <div key={ctx.id} className="border rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <GripVertical size={14} className="text-muted-foreground shrink-0" />
                <button
                  onClick={() => handleToggle(ctx.id, ctx.is_active)}
                  className="shrink-0"
                  title={ctx.is_active ? '点击停用' : '点击启用'}
                >
                  {ctx.is_active
                    ? <Eye size={14} className="text-green-600" />
                    : <EyeOff size={14} className="text-muted-foreground" />
                  }
                </button>
                {editing === ctx.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 text-sm px-2 py-1 border rounded bg-background"
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium truncate">{ctx.title || '(未命名)'}</span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {CONTEXT_TYPES.find(t => t.value === ctx.context_type)?.label || ctx.context_type}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${ctx.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {ctx.is_active ? '启用' : '停用'}
                </span>
                {editing === ctx.id ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="text-xs px-2 py-1 border rounded bg-background"
                    >
                      {CONTEXT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => handleSave(ctx.id)} disabled={saving} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Save size={14} />
                    </button>
                    <button onClick={() => setEditing(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded text-xs">取消</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setEditing(ctx.id); setEditContent(ctx.content); setEditTitle(ctx.title); setEditType(ctx.context_type); }}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded text-xs"
                    >
                      编辑
                    </button>
                    <button onClick={() => handleDelete(ctx.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {/* Content area */}
              {editing === ctx.id ? (
                <div className="p-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={12}
                    className="w-full text-xs font-mono px-3 py-2 border rounded bg-background resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入上下文内容，将自动注入到系统提示中..."
                  />
                  <div className="text-xs text-muted-foreground mt-1">{editContent.length} 字符</div>
                </div>
              ) : (
                <div className="px-4 py-2 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                  {ctx.content ? ctx.content.slice(0, 300) + (ctx.content.length > 300 ? '...' : '') : '(空内容)'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
