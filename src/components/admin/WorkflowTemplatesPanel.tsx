'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';

interface Template { id: string; name: string; description: string; trigger_patterns: string[]; agent_type: string; steps: any[]; system_prompt: string; is_active: boolean; usage_count: number; }
const AGENT_TYPES = [{value:'coder',label:'\u7f16\u7801\u5458'},{value:'researcher',label:'\u8c03\u7814\u5458'},{value:'reviewer',label:'\u5ba1\u67e5\u5458'},{value:'writer',label:'\u5199\u624b'},{value:'tester',label:'\u6d4b\u8bd5\u5458'}];

export default function WorkflowTemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [edit, setEdit] = useState<Partial<Template>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => { try { const r = await fetch('/api/admin/workflow-templates'); setTemplates(await r.json()); } catch {} finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  const apiCall = async (body: any) => fetch('/api/admin/workflow-templates', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });

  const handleCreate = async () => { setSaving(true); await apiCall({action:'create',name:'\u65b0\u5de5\u4f5c\u6d41\u6a21\u677f',description:'',trigger_patterns:[],agent_type:'coder',steps:[],system_prompt:''}); await load(); setSaving(false); setMsg('\u5df2\u521b\u5efa'); setTimeout(()=>setMsg(''),2000); };
  const handleSave = async (id:string) => { setSaving(true); await apiCall({action:'update',id,...edit}); setExpanded(null); await load(); setSaving(false); setMsg('\u5df2\u4fdd\u5b58'); setTimeout(()=>setMsg(''),2000); };
  const handleToggle = async (id:string, active:boolean) => { await apiCall({action:'toggle',id,is_active:!active}); await load(); };
  const handleDelete = async (id:string) => { if(!confirm('\u786e\u5b9a\u5220\u9664\uff1f'))return; await apiCall({action:'delete',id}); await load(); setMsg('\u5df2\u5220\u9664'); setTimeout(()=>setMsg(''),2000); };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{'\u52a0\u8f7d\u4e2d...'}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{'\u5de5\u4f5c\u6d41\u6a21\u677f\u7ba1\u7406'}</h3>
          <p className="text-xs text-muted-foreground mt-1">{'\u9884\u5b9a\u4e49\u7684\u591a\u6b65\u9aa4\u5de5\u4f5c\u6d41\u3002\u5b50\u667a\u80fd\u4f53\u6267\u884c\u65f6\u81ea\u52a8\u5339\u914d\u89e6\u53d1\u8bcd\uff0c\u4f7f\u7528\u6a21\u677f\u4e2d\u7684\u6b65\u9aa4\u548c\u63d0\u793a\u8bcd\u3002'}</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-green-600">{msg}</span>}
          <button onClick={handleCreate} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"><Plus size={14} /> {'\u65b0\u589e\u6a21\u677f'}</button>
        </div>
      </div>
      {templates.length === 0 ? <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">{'\u6682\u65e0\u5de5\u4f5c\u6d41\u6a21\u677f'}</div> : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50" onClick={()=>{setExpanded(expanded===t.id?null:t.id);if(expanded!==t.id)setEdit(t);}}>
                <button onClick={e=>{e.stopPropagation();handleToggle(t.id,t.is_active);}} className="shrink-0">{t.is_active?<Eye size={14} className="text-green-600"/>:<EyeOff size={14} className="text-muted-foreground"/>}</button>
                <span className="flex-1 text-sm font-medium">{t.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{AGENT_TYPES.find(a=>a.value===t.agent_type)?.label||t.agent_type}</span>
                <span className="text-xs text-muted-foreground">{'\u4f7f\u7528'} {t.usage_count} {'\u6b21'}</span>
                <span className={"text-xs px-1.5 py-0.5 rounded "+(t.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500')}>{t.is_active?'\u542f\u7528':'\u505c\u7528'}</span>
                {expanded===t.id?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
              </div>
              {expanded===t.id && (
                <div className="p-4 space-y-3 border-t bg-background">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-muted-foreground">{'\u6a21\u677f\u540d\u79f0'}</label><input value={edit.name||''} onChange={e=>setEdit({...edit,name:e.target.value})} className="w-full text-sm px-2 py-1.5 border rounded bg-background mt-0.5" /></div>
                    <div><label className="text-xs text-muted-foreground">{'\u667a\u80fd\u4f53\u7c7b\u578b'}</label><select value={edit.agent_type||'coder'} onChange={e=>setEdit({...edit,agent_type:e.target.value})} className="w-full text-sm px-2 py-1.5 border rounded bg-background mt-0.5">{AGENT_TYPES.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
                  </div>
                  <div><label className="text-xs text-muted-foreground">{'\u63cf\u8ff0'}</label><input value={edit.description||''} onChange={e=>setEdit({...edit,description:e.target.value})} className="w-full text-xs px-2 py-1.5 border rounded bg-background mt-0.5" /></div>
                  <div><label className="text-xs text-muted-foreground">{'\u89e6\u53d1\u8bcd\uff08\u9017\u53f7\u5206\u9694\uff09'}</label><input value={(edit.trigger_patterns||[]).join(', ')} onChange={e=>setEdit({...edit,trigger_patterns:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} placeholder={'\u4ee3\u7801\u5ba1\u67e5, code review'} className="w-full text-xs px-2 py-1.5 border rounded bg-background mt-0.5" /></div>
                  <div><label className="text-xs text-muted-foreground">{'\u6267\u884c\u6b65\u9aa4 (JSON)'}</label><textarea value={JSON.stringify(edit.steps||[],null,2)} onChange={e=>{try{setEdit({...edit,steps:JSON.parse(e.target.value)});}catch{}}} rows={4} className="w-full text-xs font-mono px-2 py-1.5 border rounded bg-background mt-0.5 resize-y" /></div>
                  <div><label className="text-xs text-muted-foreground">{'\u7cfb\u7edf\u63d0\u793a\u8bcd'}</label><textarea value={edit.system_prompt||''} onChange={e=>setEdit({...edit,system_prompt:e.target.value})} rows={4} className="w-full text-xs px-2 py-1.5 border rounded bg-background mt-0.5 resize-y" /></div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <button onClick={()=>handleSave(t.id)} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"><Save size={12} /> {'\u4fdd\u5b58'}</button>
                    <button onClick={()=>handleDelete(t.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs border text-red-500 rounded-md hover:bg-red-50"><Trash2 size={12} /> {'\u5220\u9664'}</button>
                    <button onClick={()=>setExpanded(null)} className="px-3 py-1.5 text-xs text-muted-foreground">{'\u53d6\u6d88'}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
