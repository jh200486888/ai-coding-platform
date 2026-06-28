'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, Check, GripVertical, Image, Type, Layout, Video, Presentation, Sparkles, Shapes, Upload, Layers, MessageSquare } from 'lucide-react';

interface Category { id: string; name: string; icon: string; sort_order: number; is_active: boolean; }
interface Template { id: string; name: string; category_id: string; prompt: string; thumbnail: string; sort_order: number; is_active: boolean; }
interface Tool { id: string; name: string; icon: string; sort_order: number; is_active: boolean; }
interface Suggestion { id: string; text: string; sort_order: number; is_active: boolean; }

const ICON_MAP: Record<string, React.ReactNode> = {
  'Sparkles': <Sparkles size={14} />, 'Image': <Image size={14} />, 'Type': <Type size={14} />,
  'Presentation': <Presentation size={14} />, 'Layout': <Layout size={14} />, 'Video': <Video size={14} />,
  'Shapes': <Shapes size={14} />, 'Upload': <Upload size={14} />, 'Layers': <Layers size={14} />,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

export function DesignConfigPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<{type: string; id: string} | null>(null);
  const [showNew, setShowNew] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/design-config');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setTemplates(data.templates || []);
        setTools(data.tools || []);
        setSuggestions(data.suggestions || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveItem = async (type: string, item: any) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...item }),
    });
    if (res.ok) { loadData(); setEditState(null); setShowNew(null); }
  };

  const updateItem = async (type: string, item: any) => {
    const res = await fetch('/api/admin/design-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...item }),
    });
    if (res.ok) { loadData(); setEditState(null); }
  };

  const deleteItem = async (type: string, id: string) => {
    if (!confirm('确定删除？')) return;
    const res = await fetch(`/api/admin/design-config?type=${type}&id=${id}`, { method: 'DELETE' });
    if (res.ok) loadData();
  };

  const toggleActive = async (type: string, item: any) => {
    await updateItem(type, { ...item, is_active: !item.is_active });
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      {/* Categories */}
      <Section title="设计分类" icon={<Layout size={16} />} onAdd={() => setShowNew('cat')}>
        {categories.map(cat => (
          <ConfigRow key={cat.id} active={cat.is_active} onToggle={() => toggleActive('category', cat)}
            onEdit={() => setEditState({type:'cat', id:cat.id})} onDelete={() => deleteItem('category', cat.id)}>
            {editState?.type==='cat' && editState?.id===cat.id ? (
              <InlineEdit fields={[{key:'name',value:cat.name,label:'名称'},{key:'icon',value:cat.icon,label:'图标',type:'select',options:ICON_OPTIONS},{key:'sort_order',value:cat.sort_order,label:'排序',type:'number'}]}
                item={cat} setItem={(u: any) => setCategories(p => p.map(c => c.id===cat.id ? {...c,...u} : c))}
                onSave={() => updateItem('category', cat)} onCancel={() => setEditState(null)} />
            ) : (
              <>
                <div className="flex items-center gap-1.5 w-6 justify-center">{ICON_MAP[cat.icon] || <Sparkles size={14}/>}</div>
                <span className="font-medium text-sm flex-1">{cat.name}</span>
                <span className="text-xs text-muted-foreground">排序:{cat.sort_order}</span>
              </>
            )}
          </ConfigRow>
        ))}
        {showNew==='cat' && <NewRow fields={[{key:'id',label:'ID(英文)'},{key:'name',label:'名称'},{key:'icon',label:'图标',type:'select',options:ICON_OPTIONS},{key:'sort_order',label:'排序',type:'number'}]}
          onSave={(item: any) => saveItem('category', item)} onCancel={() => setShowNew(null)} />}
      </Section>

      {/* Templates */}
      <Section title="设计模板" icon={<Image size={16} />} onAdd={() => setShowNew('tpl')}>
        {templates.map(tpl => (
          <div key={tpl.id} className={`p-3 rounded-lg border ${tpl.is_active ? 'border-border bg-background' : 'border-border bg-background opacity-50'}`}>
            {editState?.type==='tpl' && editState?.id===tpl.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input value={tpl.name} onChange={e => setTemplates(p => p.map(t => t.id===tpl.id ? {...t,name:e.target.value} : t))} className="px-2 py-1 bg-background border border-border rounded text-sm flex-1" placeholder="名称" />
                  <select value={tpl.category_id} onChange={e => setTemplates(p => p.map(t => t.id===tpl.id ? {...t,category_id:e.target.value} : t))} className="px-2 py-1 bg-background border border-border rounded text-sm">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" value={tpl.sort_order} onChange={e => setTemplates(p => p.map(t => t.id===tpl.id ? {...t,sort_order:parseInt(e.target.value)||0} : t))} className="px-2 py-1 bg-background border border-border rounded text-sm w-16" />
                </div>
                <textarea value={tpl.prompt} onChange={e => setTemplates(p => p.map(t => t.id===tpl.id ? {...t,prompt:e.target.value} : t))} className="w-full px-2 py-1 bg-background border border-border rounded text-sm" rows={2} />
                <div className="flex gap-2">
                  <button onClick={() => updateItem('template', tpl)} className="px-3 py-1 bg-green-500/10 text-green-500 rounded text-sm flex items-center gap-1"><Check size={14}/> 保存</button>
                  <button onClick={() => setEditState(null)} className="px-3 py-1 bg-muted rounded text-sm flex items-center gap-1"><X size={14}/> 取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{tpl.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{categories.find(c => c.id===tpl.category_id)?.name || tpl.category_id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tpl.prompt}</p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={() => toggleActive('template', tpl)} className={`px-2 py-0.5 rounded text-xs ${tpl.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{tpl.is_active ? '启用' : '禁用'}</button>
                  <button onClick={() => setEditState({type:'tpl',id:tpl.id})} className="p-1 hover:bg-accent rounded"><Edit2 size={14}/></button>
                  <button onClick={() => deleteItem('template', tpl.id)} className="p-1 hover:bg-accent rounded"><Trash2 size={14} className="text-red-500"/></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {showNew==='tpl' && <NewTemplateRow categories={categories} onSave={(item: any) => saveItem('template', item)} onCancel={() => setShowNew(null)} />}
      </Section>

      {/* Tools */}
      <Section title="编辑器工具" icon={<Shapes size={16} />} onAdd={() => setShowNew('tool')}>
        {tools.map(tool => (
          <ConfigRow key={tool.id} active={tool.is_active} onToggle={() => toggleActive('tool', tool)}
            onEdit={() => setEditState({type:'tool',id:tool.id})} onDelete={() => deleteItem('tool', tool.id)}>
            {editState?.type==='tool' && editState?.id===tool.id ? (
              <InlineEdit fields={[{key:'name',value:tool.name,label:'名称'},{key:'icon',value:tool.icon,label:'图标',type:'select',options:ICON_OPTIONS},{key:'sort_order',value:tool.sort_order,label:'排序',type:'number'}]}
                item={tool} setItem={(u: any) => setTools(p => p.map(t => t.id===tool.id ? {...t,...u} : t))}
                onSave={() => updateItem('tool', tool)} onCancel={() => setEditState(null)} />
            ) : (
              <>
                <div className="flex items-center gap-1.5 w-6 justify-center">{ICON_MAP[tool.icon] || <Shapes size={14}/>}</div>
                <span className="font-medium text-sm flex-1">{tool.name}</span>
                <span className="text-xs text-muted-foreground">排序:{tool.sort_order}</span>
              </>
            )}
          </ConfigRow>
        ))}
        {showNew==='tool' && <NewRow fields={[{key:'id',label:'ID(英文)'},{key:'name',label:'名称'},{key:'icon',label:'图标',type:'select',options:ICON_OPTIONS},{key:'sort_order',label:'排序',type:'number'}]}
          onSave={(item: any) => saveItem('tool', item)} onCancel={() => setShowNew(null)} />}
      </Section>

      {/* Suggestions */}
      <Section title="快捷建议" icon={<MessageSquare size={16} />} onAdd={() => setShowNew('sug')}>
        {suggestions.map(sug => (
          <ConfigRow key={sug.id} active={sug.is_active} onToggle={() => toggleActive('suggestion', sug)}
            onEdit={() => setEditState({type:'sug',id:sug.id})} onDelete={() => deleteItem('suggestion', sug.id)}>
            {editState?.type==='sug' && editState?.id===sug.id ? (
              <InlineEdit fields={[{key:'text',value:sug.text,label:'建议文本'},{key:'sort_order',value:sug.sort_order,label:'排序',type:'number'}]}
                item={sug} setItem={(u: any) => setSuggestions(p => p.map(s => s.id===sug.id ? {...s,...u} : s))}
                onSave={() => updateItem('suggestion', sug)} onCancel={() => setEditState(null)} />
            ) : (
              <>
                <span className="font-medium text-sm flex-1">{sug.text}</span>
                <span className="text-xs text-muted-foreground">排序:{sug.sort_order}</span>
              </>
            )}
          </ConfigRow>
        ))}
        {showNew==='sug' && <NewRow fields={[{key:'id',label:'ID'},{key:'text',label:'建议文本'},{key:'sort_order',label:'排序',type:'number'}]}
          onSave={(item: any) => saveItem('suggestion', item)} onCancel={() => setShowNew(null)} />}
      </Section>
    </div>
  );
}

// ============ Reusable Components ============

function Section({ title, icon, onAdd, children }: { title: string; icon: React.ReactNode; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">{icon} {title}</h3>
        <button onClick={onAdd} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"><Plus size={14} /> 新增</button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ConfigRow({ active, onToggle, onEdit, onDelete, children }: { active: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${active ? 'border-border bg-background' : 'border-border bg-background opacity-50'}`}>
      <GripVertical size={14} className="text-muted-foreground cursor-grab" />
      {children}
      <button onClick={onToggle} className={`px-2 py-0.5 rounded text-xs shrink-0 ${active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{active ? '启用' : '禁用'}</button>
      <button onClick={onEdit} className="p-1 hover:bg-accent rounded shrink-0"><Edit2 size={14}/></button>
      <button onClick={onDelete} className="p-1 hover:bg-accent rounded shrink-0"><Trash2 size={14} className="text-red-500"/></button>
    </div>
  );
}

function InlineEdit({ fields, item, setItem, onSave, onCancel }: any) {
  return (
    <div className="flex-1 flex items-center gap-2 flex-wrap">
      {fields.map((f: any) => f.type === 'select' ? (
        <select key={f.key} value={item[f.key]} onChange={e => setItem({[f.key]: e.target.value})} className="px-2 py-1 bg-background border border-border rounded text-sm">
          {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input key={f.key} type={f.type || 'text'} value={item[f.key]} onChange={e => setItem({[f.key]: f.type==='number' ? parseInt(e.target.value)||0 : e.target.value})} className="px-2 py-1 bg-background border border-border rounded text-sm" placeholder={f.label} style={{width: f.type==='number' ? '4rem' : undefined, flex: f.type==='number' ? undefined : 1}} />
      ))}
      <button onClick={onSave} className="p-1 hover:bg-accent rounded"><Check size={14} className="text-green-500"/></button>
      <button onClick={onCancel} className="p-1 hover:bg-accent rounded"><X size={14}/></button>
    </div>
  );
}

function NewRow({ fields, onSave, onCancel }: any) {
  const [item, setItem] = useState<Record<string, any>>({});
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5 flex-wrap">
      {fields.map((f: any) => f.type === 'select' ? (
        <select key={f.key} value={item[f.key] || ''} onChange={e => setItem(p => ({...p, [f.key]: e.target.value}))} className="px-2 py-1 bg-background border border-border rounded text-sm">
          {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input key={f.key} type={f.type || 'text'} value={item[f.key] || ''} onChange={e => setItem(p => ({...p, [f.key]: f.type==='number' ? parseInt(e.target.value)||0 : e.target.value}))} className="px-2 py-1 bg-background border border-border rounded text-sm" placeholder={f.label} style={{width: f.type==='number' ? '4rem' : undefined, flex: f.type==='number' ? undefined : 1}} />
      ))}
      <button onClick={() => onSave(item)} className="p-1 hover:bg-accent rounded"><Check size={14} className="text-green-500"/></button>
      <button onClick={onCancel} className="p-1 hover:bg-accent rounded"><X size={14}/></button>
    </div>
  );
}

function NewTemplateRow({ categories, onSave, onCancel }: any) {
  const [item, setItem] = useState<Record<string, any>>({});
  return (
    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
      <div className="flex items-center gap-2">
        <input placeholder="模板ID" value={item.id || ''} onChange={e => setItem(p => ({...p, id: e.target.value}))} className="px-2 py-1 bg-background border border-border rounded text-sm w-28" />
        <input placeholder="名称" value={item.name || ''} onChange={e => setItem(p => ({...p, name: e.target.value}))} className="px-2 py-1 bg-background border border-border rounded text-sm flex-1" />
        <select value={item.category_id || 'all'} onChange={e => setItem(p => ({...p, category_id: e.target.value}))} className="px-2 py-1 bg-background border border-border rounded text-sm">
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <textarea placeholder="提示词" value={item.prompt || ''} onChange={e => setItem(p => ({...p, prompt: e.target.value}))} className="w-full px-2 py-1 bg-background border border-border rounded text-sm" rows={2} />
      <div className="flex gap-2">
        <button onClick={() => onSave(item)} className="px-3 py-1 bg-green-500/10 text-green-500 rounded text-sm flex items-center gap-1"><Check size={14}/> 保存</button>
        <button onClick={onCancel} className="px-3 py-1 bg-muted rounded text-sm flex items-center gap-1"><X size={14}/> 取消</button>
      </div>
    </div>
  );
}
