'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface ModelItem {
  id: string;
  name: string;
  provider: string;
  desc: string;
  maxN: number;
  supportsEdit: boolean;
  enabled: boolean;
}
interface RatioItem { id: string; label: string; w: number; h: number; enabled: boolean; }
interface ResolutionItem { id: string; label: string; desc: string; enabled: boolean; }
interface QualityItem { id: string; label: string; enabled: boolean; }
interface StyleItem { id: string; label: string; prefix: string; enabled: boolean; }
interface CountItem { id: number; label: string; enabled: boolean; }
interface FormatItem { id: string; label: string; enabled: boolean; }

interface ImageGenConfig {
  models: ModelItem[];
  ratios: RatioItem[];
  resolutions: ResolutionItem[];
  qualities: QualityItem[];
  styles: StyleItem[];
  counts: CountItem[];
  formats: FormatItem[];
  maxUploadSizeMB: number;
  defaultModel: string;
  defaultRatio: string;
  defaultResolution: string;
  defaultQuality: string;
  defaultStyle: string;
  defaultCount: number;
  defaultFormat: string;
}

type SubTab = 'models' | 'ratios' | 'resolutions' | 'qualities' | 'styles' | 'counts' | 'formats' | 'general';

export function ImageGenPanel() {
  const [config, setConfig] = useState<ImageGenConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('models');

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/image-gen-config');
      const data = await res.json();
      if (data.success) setConfig(data.data);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/image-gen-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('保存成功！');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('保存失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      setMessage('保存失败: 网络错误');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'models', label: '模型' },
    { id: 'ratios', label: '尺寸比例' },
    { id: 'resolutions', label: '分辨率' },
    { id: 'qualities', label: '画质' },
    { id: 'styles', label: '风格预设' },
    { id: 'counts', label: '生成数量' },
    { id: 'formats', label: '输出格式' },
    { id: 'general', label: '通用设置' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">图片生成配置</h2>
        <div className="flex gap-2 items-center">
          {message && <span className="text-sm text-green-500">{message}</span>}
          <button onClick={fetchConfig} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent">
            <RefreshCw size={14} /> 刷新
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
            <Save size={14} /> {saving ? '保存中...' : '保存全部'}
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 mb-4 border-b border-border pb-2 flex-wrap">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setActiveSubTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSubTab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'models' && <ModelsEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'ratios' && <RatiosEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'resolutions' && <ResolutionsEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'qualities' && <QualitiesEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'styles' && <StylesEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'counts' && <CountsEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'formats' && <FormatsEditor config={config} setConfig={setConfig} />}
      {activeSubTab === 'general' && <GeneralEditor config={config} setConfig={setConfig} />}
    </div>
  );
}

// Toggle helper
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="p-1 transition-colors" title={enabled ? '点击禁用' : '点击启用'}>
      {enabled ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
    </button>
  );
}

// ---- Models Editor ----
function ModelsEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const updateModel = (idx: number, field: keyof ModelItem, value: any) => {
    const models = [...config.models];
    models[idx] = { ...models[idx], [field]: value };
    setConfig({ ...config, models });
  };
  const removeModel = (idx: number) => {
    setConfig({ ...config, models: config.models.filter((_, i) => i !== idx) });
  };
  const addModel = () => {
    setConfig({ ...config, models: [...config.models, { id: '', name: '', provider: '', desc: '', maxN: 4, supportsEdit: false, enabled: true }] });
  };

  return (
    <div className="space-y-3">
      {config.models.map((m, idx) => (
        <div key={idx} className="p-4 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <Toggle enabled={m.enabled} onToggle={() => updateModel(idx, 'enabled', !m.enabled)} />
            <input value={m.id} onChange={e => updateModel(idx, 'id', e.target.value)} placeholder="模型ID" className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm" />
            <input value={m.name} onChange={e => updateModel(idx, 'name', e.target.value)} placeholder="显示名称" className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm" />
            <button onClick={() => removeModel(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
          </div>
          <div className="flex gap-2 items-center">
            <input value={m.provider} onChange={e => updateModel(idx, 'provider', e.target.value)} placeholder="厂商" className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm" />
            <input value={m.desc} onChange={e => updateModel(idx, 'desc', e.target.value)} placeholder="描述" className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm" />
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              最大数量:
              <input type="number" value={m.maxN} onChange={e => updateModel(idx, 'maxN', Number(e.target.value))} className="w-16 px-2 py-1 rounded bg-background border border-border text-sm text-center" />
            </label>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <input type="checkbox" checked={m.supportsEdit} onChange={e => updateModel(idx, 'supportsEdit', e.target.checked)} />
              支持改图
            </label>
          </div>
        </div>
      ))}
      <button onClick={addModel} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加模型
      </button>
    </div>
  );
}

// ---- Ratios Editor ----
function RatiosEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const update = (idx: number, field: keyof RatioItem, value: any) => {
    const ratios = [...config.ratios];
    ratios[idx] = { ...ratios[idx], [field]: value };
    setConfig({ ...config, ratios });
  };
  const remove = (idx: number) => setConfig({ ...config, ratios: config.ratios.filter((_, i) => i !== idx) });
  const add = () => setConfig({ ...config, ratios: [...config.ratios, { id: '1:1', label: '1:1', w: 32, h: 32, enabled: true }] });

  return (
    <div className="space-y-2">
      {config.ratios.map((r, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
          <Toggle enabled={r.enabled} onToggle={() => update(idx, 'enabled', !r.enabled)} />
          <input value={r.id} onChange={e => update(idx, 'id', e.target.value)} placeholder="比例ID" className="w-20 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <input value={r.label} onChange={e => update(idx, 'label', e.target.value)} placeholder="标签" className="w-20 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <label className="text-xs text-muted-foreground">宽:<input type="number" value={r.w} onChange={e => update(idx, 'w', Number(e.target.value))} className="w-14 ml-1 px-2 py-1 rounded bg-background border border-border text-sm text-center" /></label>
          <label className="text-xs text-muted-foreground">高:<input type="number" value={r.h} onChange={e => update(idx, 'h', Number(e.target.value))} className="w-14 ml-1 px-2 py-1 rounded bg-background border border-border text-sm text-center" /></label>
          <button onClick={() => remove(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded ml-auto"><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加比例
      </button>
    </div>
  );
}

// ---- Resolutions Editor ----
function ResolutionsEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const update = (idx: number, field: keyof ResolutionItem, value: any) => {
    const items = [...config.resolutions];
    items[idx] = { ...items[idx], [field]: value };
    setConfig({ ...config, resolutions: items });
  };
  const remove = (idx: number) => setConfig({ ...config, resolutions: config.resolutions.filter((_, i) => i !== idx) });
  const add = () => setConfig({ ...config, resolutions: [...config.resolutions, { id: '', label: '', desc: '', enabled: true }] });

  return (
    <div className="space-y-2">
      {config.resolutions.map((r, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
          <Toggle enabled={r.enabled} onToggle={() => update(idx, 'enabled', !r.enabled)} />
          <input value={r.id} onChange={e => update(idx, 'id', e.target.value)} placeholder="ID" className="w-20 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <input value={r.label} onChange={e => update(idx, 'label', e.target.value)} placeholder="标签" className="w-20 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <input value={r.desc} onChange={e => update(idx, 'desc', e.target.value)} placeholder="描述" className="flex-1 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <button onClick={() => remove(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加分辨率
      </button>
    </div>
  );
}

// ---- Qualities Editor ----
function QualitiesEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const update = (idx: number, field: keyof QualityItem, value: any) => {
    const items = [...config.qualities];
    items[idx] = { ...items[idx], [field]: value };
    setConfig({ ...config, qualities: items });
  };
  const remove = (idx: number) => setConfig({ ...config, qualities: config.qualities.filter((_, i) => i !== idx) });
  const add = () => setConfig({ ...config, qualities: [...config.qualities, { id: '', label: '', enabled: true }] });

  return (
    <div className="space-y-2">
      {config.qualities.map((q, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
          <Toggle enabled={q.enabled} onToggle={() => update(idx, 'enabled', !q.enabled)} />
          <input value={q.id} onChange={e => update(idx, 'id', e.target.value)} placeholder="ID" className="w-24 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <input value={q.label} onChange={e => update(idx, 'label', e.target.value)} placeholder="标签" className="flex-1 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <button onClick={() => remove(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加画质选项
      </button>
    </div>
  );
}

// ---- Styles Editor ----
function StylesEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const update = (idx: number, field: keyof StyleItem, value: any) => {
    const items = [...config.styles];
    items[idx] = { ...items[idx], [field]: value };
    setConfig({ ...config, styles: items });
  };
  const remove = (idx: number) => setConfig({ ...config, styles: config.styles.filter((_, i) => i !== idx) });
  const add = () => setConfig({ ...config, styles: [...config.styles, { id: '', label: '', prefix: '', enabled: true }] });

  return (
    <div className="space-y-3">
      {config.styles.map((s, idx) => (
        <div key={idx} className="p-3 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <Toggle enabled={s.enabled} onToggle={() => update(idx, 'enabled', !s.enabled)} />
            <input value={s.id} onChange={e => update(idx, 'id', e.target.value)} placeholder="风格ID" className="w-28 px-2 py-1.5 rounded bg-background border border-border text-sm" />
            <input value={s.label} onChange={e => update(idx, 'label', e.target.value)} placeholder="显示名称" className="flex-1 px-2 py-1.5 rounded bg-background border border-border text-sm" />
            <button onClick={() => remove(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
          </div>
          <input value={s.prefix} onChange={e => update(idx, 'prefix', e.target.value)} placeholder="Prompt 前缀（英文）" className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm font-mono" />
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加风格
      </button>
    </div>
  );
}

// ---- Counts Editor ----
function CountsEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const update = (idx: number, field: keyof CountItem, value: any) => {
    const items = [...config.counts];
    items[idx] = { ...items[idx], [field]: value };
    setConfig({ ...config, counts: items });
  };
  const remove = (idx: number) => setConfig({ ...config, counts: config.counts.filter((_, i) => i !== idx) });
  const add = () => setConfig({ ...config, counts: [...config.counts, { id: 1, label: '1', enabled: true }] });

  return (
    <div className="space-y-2">
      {config.counts.map((c, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
          <Toggle enabled={c.enabled} onToggle={() => update(idx, 'enabled', !c.enabled)} />
          <label className="text-xs text-muted-foreground">数量值:<input type="number" value={c.id} onChange={e => update(idx, 'id', Number(e.target.value))} className="w-16 ml-1 px-2 py-1 rounded bg-background border border-border text-sm text-center" /></label>
          <input value={c.label} onChange={e => update(idx, 'label', e.target.value)} placeholder="显示标签" className="flex-1 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <button onClick={() => remove(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加数量选项
      </button>
    </div>
  );
}

// ---- Formats Editor ----
function FormatsEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  const update = (idx: number, field: keyof FormatItem, value: any) => {
    const items = [...config.formats];
    items[idx] = { ...items[idx], [field]: value };
    setConfig({ ...config, formats: items });
  };
  const remove = (idx: number) => setConfig({ ...config, formats: config.formats.filter((_, i) => i !== idx) });
  const add = () => setConfig({ ...config, formats: [...config.formats, { id: '', label: '', enabled: true }] });

  return (
    <div className="space-y-2">
      {config.formats.map((f, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
          <Toggle enabled={f.enabled} onToggle={() => update(idx, 'enabled', !f.enabled)} />
          <input value={f.id} onChange={e => update(idx, 'id', e.target.value)} placeholder="格式ID" className="w-24 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <input value={f.label} onChange={e => update(idx, 'label', e.target.value)} placeholder="显示标签" className="flex-1 px-2 py-1.5 rounded bg-background border border-border text-sm" />
          <button onClick={() => remove(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30">
        <Plus size={14} /> 添加格式
      </button>
    </div>
  );
}

// ---- General Settings Editor ----
function GeneralEditor({ config, setConfig }: { config: ImageGenConfig; setConfig: (c: ImageGenConfig) => void }) {
  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">参考图上传大小上限 (MB)</label>
        <input type="number" value={config.maxUploadSizeMB} onChange={e => setConfig({ ...config, maxUploadSizeMB: Number(e.target.value) })} className="w-32 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认模型</label>
        <select value={config.defaultModel} onChange={e => setConfig({ ...config, defaultModel: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.models.filter(m => m.enabled).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认尺寸比例</label>
        <select value={config.defaultRatio} onChange={e => setConfig({ ...config, defaultRatio: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.ratios.filter(r => r.enabled).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认分辨率</label>
        <select value={config.defaultResolution} onChange={e => setConfig({ ...config, defaultResolution: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.resolutions.filter(r => r.enabled).map(r => <option key={r.id} value={r.id}>{r.label} - {r.desc}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认画质</label>
        <select value={config.defaultQuality} onChange={e => setConfig({ ...config, defaultQuality: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.qualities.filter(q => q.enabled).map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认风格</label>
        <select value={config.defaultStyle} onChange={e => setConfig({ ...config, defaultStyle: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.styles.filter(s => s.enabled).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认生成数量</label>
        <select value={config.defaultCount} onChange={e => setConfig({ ...config, defaultCount: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.counts.filter(c => c.enabled).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">默认输出格式</label>
        <select value={config.defaultFormat} onChange={e => setConfig({ ...config, defaultFormat: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {config.formats.filter(f => f.enabled).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>
    </div>
  );
}
