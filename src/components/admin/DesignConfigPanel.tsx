'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, RefreshCw, Edit2, X, Check, GripVertical, Image, Type, Layout, Video, Presentation, Sparkles, Shapes, Upload, Layers } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface Template {
  id: string;
  name: string;
  category_id: string;
  prompt: string;
  thumbnail: string;
  sort_order: number;
  is_active: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'Sparkles': <Sparkles size={14} />,
  'Image': <Image size={14} />,
  'Type': <Type size={14} />,
  'Presentation': <Presentation size={14} />,
  'Layout': <Layout size={14} />,
  'Video': <Video size={14} />,
  'Shapes': <Shapes size={14} />,
  'Upload': <Upload size={14} />,
  'Layers': <Layers size={14} />,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

export function DesignConfigPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingTpl, setEditingTpl] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ id: '', name: '', icon: 'Sparkles', sort_order: 0 });
  const [newTpl, setNewTpl] = useState({ id: '', name: '', category_id: 'all', prompt: '', thumbnail: '', sort_order: 0 });
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewTpl, setShowNewTpl] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/design-config');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveCategory = async (cat: Category) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', ...cat }),
    });
    if (res.ok) { loadData(); setEditingCat(null); }
  };

  const updateCategory = async (cat: Category) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', ...cat }),
    });
    if (res.ok) { loadData(); setEditingCat(null); }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('确定删除此分类？')) return;
    const res = await fetch(`/api/admin/design-config?type=category&id=${id}`, { method: 'DELETE' });
    if (res.ok) loadData();
  };

  const saveTemplate = async (tpl: any) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'template', ...tpl }),
    });
    if (res.ok) { loadData(); setEditingTpl(null); setShowNewTpl(false); }
  };

  const updateTemplate = async (tpl: Template) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'template', ...tpl }),
    });
    if (res.ok) { loadData(); setEditingTpl(null); }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('确定删除此模板？')) return;
    const res = await fetch(`/api/admin/design-config?type=template&id=${id}`, { method: 'DELETE' });
    if (res.ok) loadData();
  };

  const toggleActive = async (type: 'category' | 'template', item: any) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...item, is_active: !item.is_active }),
    });
    if (res.ok) loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="animate-spin mr-2" size={16} /> 加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Categories Section */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Layout size={16} /> 设计分类</h3>
          <div className="flex gap-2">
            <button onClick={loadData} className="p-1.5 hover:bg-accent rounded-md"><RefreshCw size={14} /></button>
            <button onClick={() => setShowNewCat(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"><Plus size={14} /> 新增分类</button>
          </div>
        </div>

        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className={`flex items-center gap-3 p-3 rounded-lg border ${cat.is_active ? 'border-border bg-background' : 'border-border bg-background opacity-50'}`}>
              <GripVertical size={14} className="text-muted-foreground cursor-grab" />
              <div className="flex items-center gap-1.5 w-6 justify-center">{ICON_MAP[cat.icon] || <Sparkles size={14} />}</div>
              {editingCat === cat.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input value={cat.name} onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c))} className="px-2 py-1 bg-background border border-border rounded text-sm flex-1" />
                  <select value={cat.icon} onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, icon: e.target.value } : c))} className="px-2 py-1 bg-background border border-border rounded text-sm">
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <input type="number" value={cat.sort_order} onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, sort_order: parseInt(e.target.value) || 0 } : c))} className="px-2 py-1 bg-background border border-border rounded text-sm w-16" />
                  <button onClick={() => updateCategory(cat)} className="p-1 hover:bg-accent rounded"><Check size={14} className="text-green-500" /></button>
                  <button onClick={() => setEditingCat(null)} className="p-1 hover:bg-accent rounded"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="font-medium text-sm">{cat.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{cat.icon} · 排序:{cat.sort_order}</span>
                  </div>
                  <button onClick={() => toggleActive('category', cat)} className={`px-2 py-0.5 rounded text-xs ${cat.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                    {cat.is_active ? '启用' : '禁用'}
                  </button>
                  <button onClick={() => setEditingCat(cat.id)} className="p-1 hover:bg-accent rounded"><Edit2 size={14} /></button>
                  <button onClick={() => deleteCategory(cat.id)} className="p-1 hover:bg-accent rounded"><Trash2 size={14} className="text-red-500" /></button>
                </>
              )}
            </div>
          ))}

          {showNewCat && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <input placeholder="分类ID(英文)" value={newCat.id} onChange={e => setNewCat(p => ({ ...p, id: e.target.value }))} className="px-2 py-1 bg-background border border-border rounded text-sm w-28" />
              <input placeholder="分类名称" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} className="px-2 py-1 bg-background border border-border rounded text-sm flex-1" />
              <select value={newCat.icon} onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))} className="px-2 py-1 bg-background border border-border rounded text-sm">
                {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <input type="number" placeholder="排序" value={newCat.sort_order} onChange={e => setNewCat(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="px-2 py-1 bg-background border border-border rounded text-sm w-16" />
              <button onClick={() => saveCategory(newCat as any)} className="p-1 hover:bg-accent rounded"><Check size={14} className="text-green-500" /></button>
              <button onClick={() => setShowNewCat(false)} className="p-1 hover:bg-accent rounded"><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Templates Section */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Image size={16} /> 设计模板</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowNewTpl(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"><Plus size={14} /> 新增模板</button>
          </div>
        </div>

        <div className="space-y-2">
          {templates.map(tpl => (
            <div key={tpl.id} className={`p-3 rounded-lg border ${tpl.is_active ? 'border-border bg-background' : 'border-border bg-background opacity-50'}`}>
              {editingTpl === tpl.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={tpl.name} onChange={e => setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, name: e.target.value } : t))} className="px-2 py-1 bg-background border border-border rounded text-sm flex-1" placeholder="模板名称" />
                    <select value={tpl.category_id} onChange={e => setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, category_id: e.target.value } : t))} className="px-2 py-1 bg-background border border-border rounded text-sm">
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="number" value={tpl.sort_order} onChange={e => setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, sort_order: parseInt(e.target.value) || 0 } : t))} className="px-2 py-1 bg-background border border-border rounded text-sm w-16" />
                  </div>
                  <textarea value={tpl.prompt} onChange={e => setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, prompt: e.target.value } : t))} className="w-full px-2 py-1 bg-background border border-border rounded text-sm" rows={2} placeholder="提示词" />
                  <div className="flex gap-2">
                    <button onClick={() => updateTemplate(tpl)} className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-500 rounded text-sm"><Check size={14} /> 保存</button>
                    <button onClick={() => setEditingTpl(null)} className="flex items-center gap-1 px-3 py-1 bg-muted rounded text-sm"><X size={14} /> 取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tpl.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{categories.find(c => c.id === tpl.category_id)?.name || tpl.category_id}</span>
                      <span className="text-xs text-muted-foreground">排序:{tpl.sort_order}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{tpl.prompt}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => toggleActive('template', tpl)} className={`px-2 py-0.5 rounded text-xs ${tpl.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                      {tpl.is_active ? '启用' : '禁用'}
                    </button>
                    <button onClick={() => setEditingTpl(tpl.id)} className="p-1 hover:bg-accent rounded"><Edit2 size={14} /></button>
                    <button onClick={() => deleteTemplate(tpl.id)} className="p-1 hover:bg-accent rounded"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showNewTpl && (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2">
                <input placeholder="模板ID" value={newTpl.id} onChange={e => setNewTpl(p => ({ ...p, id: e.target.value }))} className="px-2 py-1 bg-background border border-border rounded text-sm w-28" />
                <input placeholder="模板名称" value={newTpl.name} onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))} className="px-2 py-1 bg-background border border-border rounded text-sm flex-1" />
                <select value={newTpl.category_id} onChange={e => setNewTpl(p => ({ ...p, category_id: e.target.value }))} className="px-2 py-1 bg-background border border-border rounded text-sm">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" placeholder="排序" value={newTpl.sort_order} onChange={e => setNewTpl(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="px-2 py-1 bg-background border border-border rounded text-sm w-16" />
              </div>
              <textarea placeholder="提示词（AI生成设计时使用的提示）" value={newTpl.prompt} onChange={e => setNewTpl(p => ({ ...p, prompt: e.target.value }))} className="w-full px-2 py-1 bg-background border border-border rounded text-sm" rows={2} />
              <div className="flex gap-2">
                <button onClick={() => saveTemplate(newTpl)} className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-500 rounded text-sm"><Check size={14} /> 保存</button>
                <button onClick={() => { setShowNewTpl(false); setNewTpl({ id: '', name: '', category_id: 'all', prompt: '', thumbnail: '', sort_order: 0 }); }} className="flex items-center gap-1 px-3 py-1 bg-muted rounded text-sm"><X size={14} /> 取消</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

