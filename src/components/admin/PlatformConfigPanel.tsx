// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

type SubTab = 'providers' | 'tools' | 'identity' | 'patrol';


function NotificationConfigSection() {
  const [config, setConfig] = useState<any>({ enabled: false, webhooks: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/platform-config?key=notification_config')
      .then(r => r.json())
      .then(data => {
        if (data.value) setConfig(JSON.parse(data.value));
        else setConfig({ enabled: false, webhooks: [
          { type: 'dingtalk', url: '', secret: '', enabled: false, label: '钉钉群' },
          { type: 'feishu', url: '', secret: '', enabled: false, label: '飞书群' },
          { type: 'custom', url: '', secret: '', enabled: false, label: '自定义Webhook' },
        ]});
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const updateWh = (idx: number, field: string, val: any) => {
    setConfig((p: any) => { const wh = [...p.webhooks]; wh[idx] = {...wh[idx], [field]: val}; return {...p, webhooks: wh}; });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/platform-config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({key:'notification_config', value:JSON.stringify(config)}) });
      setDirty(false); setMessage('已保存'); setTimeout(()=>setMessage(''),2000);
    } finally { setSaving(false); }
  };

  const handleTest = async (idx: number) => {
    const wh = config.webhooks[idx];
    if (!wh.url) { toast.error('请先填写Webhook地址'); return; }
    try {
      const res = await fetch('/api/admin/test-notification', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(wh) });
      const data = await res.json();
      data.success ? toast.success('测试消息发送成功!') : toast.error('发送失败: '+(data.error||''));
    } catch { toast.error('请求失败'); }
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">IM 告警通知</h4>
          <p className="text-xs text-muted-foreground mt-1">巡检发现异常时自动推送告警到钉钉/飞书群。</p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-green-600">{message}</span>}
          {dirty && <span className="text-xs text-orange-500">● 未保存</span>}
          <button onClick={handleSave} disabled={!dirty||saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">保存</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={config.enabled} onChange={e=>{setConfig((p:any)=>({...p,enabled:e.target.checked}));setDirty(true);}} className="w-4 h-4" id="notif-en" />
        <label htmlFor="notif-en" className="text-sm">启用告警通知</label>
      </div>
      <div className="space-y-3">
        {config.webhooks.map((wh:any, idx:number) => (
          <div key={idx} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={wh.enabled} onChange={e=>updateWh(idx,'enabled',e.target.checked)} className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">{wh.label||wh.type}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{wh.type}</span>
              </div>
              <button onClick={()=>handleTest(idx)} disabled={!wh.url||!wh.enabled} className="px-2 py-1 text-xs border rounded hover:bg-muted disabled:opacity-50">测试</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Webhook URL</label>
                <input value={wh.url} onChange={e=>updateWh(idx,'url',e.target.value)} placeholder={wh.type==='dingtalk'?'https://oapi.dingtalk.com/robot/send?access_token=...':wh.type==='feishu'?'https://open.feishu.cn/open-apis/bot/v2/hook/...':'https://...'} className="w-full text-xs px-2 py-1.5 border rounded bg-background mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{wh.type==='dingtalk'?'加签密钥(可选)':'密钥(可选)'}</label>
                <input value={wh.secret||''} onChange={e=>updateWh(idx,'secret',e.target.value)} placeholder="留空则不签名" className="w-full text-xs px-2 py-1.5 border rounded bg-background mt-0.5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlatformConfigPanel() {
  const [subTab, setSubTab] = useState<SubTab>('providers');
  const [config, setConfig] = useState<any>(null);
  const [defaults, setDefaults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/platform-config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setDefaults(data.data.defaults);
      }
    } catch (e) { toast.error('加载配置失败'); }
    setLoading(false);
  };

  const saveKey = async (key: string, value: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('已保存');
        setDirty(prev => { const n = new Set(prev); n.delete(key); return n; });
        fetchConfig();
      } else {
        toast.error('保存失败: ' + (data.error || ''));
      }
    } catch (e) { toast.error('保存失败'); }
    setSaving(false);
  };

  const markDirty = (key: string) => {
    setDirty(prev => new Set(prev).add(key));
  };

  const resetToDefault = (key: string) => {
    if (!defaults || !config) return;
    const defaultMap: Record<string, string> = {
      provider_urls: 'provider_urls',
      mode_tool_whitelist: 'mode_tool_whitelist',
      model_identity: 'model_identity',
      tool_name_zh: 'tool_name_zh',
      patrol_config: 'patrol_config',
      provider_max_tokens: 'provider_max_tokens',
    };
    const defKey = defaultMap[key];
    if (defKey && defaults[defKey]) {
      setConfig((prev: any) => ({ ...prev, [key]: JSON.parse(JSON.stringify(defaults[defKey])) }));
      markDirty(key);
      toast.info('已恢复默认，点击保存生效');
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  if (!config) return <div className="text-center py-8 text-red-500">加载失败</div>;

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'providers', label: 'Provider URLs' },
    { key: 'tools', label: '工具白名单' },
    { key: 'identity', label: '模型身份' },
    { key: 'patrol', label: '巡检配置' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">平台配置管理</h2>
        <span className="text-xs text-muted-foreground">所有功能配置从数据库读取，禁止硬编码</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 flex-wrap border-b border-border pb-2">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={'px-3 py-1.5 rounded-lg text-sm transition-colors ' +
              (subTab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground')}>
            {t.label}
            {dirty.has(configKeyForTab(t.key)) && <span className="ml-1 text-yellow-400">*</span>}
          </button>
        ))}
      </div>

      {subTab === 'providers' && <ProviderUrlsPanel config={config} defaults={defaults} onSave={(v) => saveKey('provider_urls', v)} onReset={() => resetToDefault('provider_urls')} onDirty={() => markDirty('provider_urls')} dirty={dirty.has('provider_urls')} />}
      {subTab === 'tools' && <ToolWhitelistPanel config={config} defaults={defaults} onSave={(v) => saveKey('mode_tool_whitelist', v)} onReset={() => resetToDefault('mode_tool_whitelist')} onDirty={() => markDirty('mode_tool_whitelist')} dirty={dirty.has('mode_tool_whitelist')} />}
      {subTab === 'identity' && <ModelIdentityPanel config={config} defaults={defaults} onSave={(v) => saveKey('model_identity', v)} onReset={() => resetToDefault('model_identity')} onDirty={() => markDirty('model_identity')} dirty={dirty.has('model_identity')} />}
      {subTab === 'patrol' && <PatrolConfigPanel config={config}
        defaults={defaults} onSave={(v) => saveKey('patrol_config', v)} onReset={() => resetToDefault('patrol_config')} onDirty={() => markDirty('patrol_config')} dirty={dirty.has('patrol_config')} />}
    </div>
  );
}

function configKeyForTab(tab: SubTab): string {
  const map: Record<SubTab, string> = {
    providers: 'provider_urls', tools: 'mode_tool_whitelist',
    identity: 'model_identity', patrol: 'patrol_config', notification: 'notification_config',
  };
  return map[tab];
}

// ============ Provider URLs Panel ============
function ProviderUrlsPanel({ config, defaults, onSave, onReset, onDirty, dirty }: any) {
  const [urls, setUrls] = useState<Record<string, string>>(config.provider_urls || {});
  const [newProvider, setNewProvider] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const addProvider = () => {
    if (!newProvider.trim() || !newUrl.trim()) return;
    setUrls((prev: any) => ({ ...prev, [newProvider.trim()]: newUrl.trim() }));
    if (onDirty) onDirty();
    setNewProvider(''); setNewUrl('');
  };
  const removeProvider = (key: string) => {
    setUrls((prev: any) => { const n = { ...prev }; delete n[key]; return n; });
    if (onDirty) onDirty();
  };
  const updateUrl = (key: string, val: string) => {
    setUrls((prev: any) => ({ ...prev, [key]: val }));
    if (onDirty) onDirty();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">AI 提供商 API 基础地址。修改后立即生效。</p>
        <div className="flex gap-2">
          <button onClick={onReset} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground">恢复默认</button>
          <button onClick={() => onSave(urls)} disabled={!dirty} className={'px-3 py-1 text-xs rounded ' + (dirty ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed')}>保存</button>
        </div>
      </div>
      <div className="space-y-1.5">
        {Object.entries(urls).map(([provider, url]: [string, any]) => (
          <div key={provider} className="flex items-center gap-2">
            <span className="w-28 text-sm font-mono text-right shrink-0">{provider}</span>
            <input value={url} onChange={e => updateUrl(provider, e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded bg-background border border-border font-mono" />
            <button onClick={() => removeProvider(provider)} className="text-red-400 hover:text-red-500 text-xs px-1">x</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
        <input value={newProvider} onChange={e => setNewProvider(e.target.value)} placeholder="provider名" className="w-28 px-2 py-1 text-sm rounded bg-background border border-border" />
        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="flex-1 px-2 py-1 text-sm rounded bg-background border border-border font-mono" />
        <button onClick={addProvider} className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">添加</button>
      </div>
    </div>
  );
}



// ============ Tool Whitelist Panel ============
function ToolWhitelistPanel({ config, defaults, onSave, onReset, onDirty, dirty }: any) {
  const [tools, setTools] = useState<Record<string, string[]>>(config.mode_tool_whitelist || {});
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const startEdit = (mode: string) => {
    setEditMode(mode);
    setEditText((tools[mode] || []).join(', '));
  };
  const saveEdit = () => {
    if (editMode) {
      const toolList = editText.split(',').map((s: string) => s.trim()).filter(Boolean);
      setTools((prev: any) => {
        const original = prev[editMode] || [];
        const changed = toolList.length !== original.length || toolList.some((t: string, i: number) => t !== original[i]);
        if (changed && onDirty) onDirty();
        return { ...prev, [editMode]: toolList };
      });
      setEditMode(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">每个模式可用的工具列表。逗号分隔工具名。</p>
        <div className="flex gap-2">
          <button onClick={onReset} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground">恢复默认</button>
          <button onClick={() => onSave(tools)} disabled={!dirty} className={'px-3 py-1 text-xs rounded ' + (dirty ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed')}>保存</button>
        </div>
      </div>
      {Object.entries(tools).map(([mode, toolList]: [string, any]) => (
        <div key={mode} className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{mode}</span>
            <span className="text-xs text-muted-foreground">{toolList.length} 个工具</span>
          </div>
          {editMode === mode ? (
            <div className="space-y-2">
              <textarea value={editText} onChange={e => setEditText(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded bg-background border border-border font-mono h-24" />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground">确定</button>
                <button onClick={() => setEditMode(null)} className="px-2 py-1 text-xs rounded bg-muted">取消</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 cursor-pointer" onClick={() => startEdit(mode)}>
              {toolList.map((t: string) => (
                <span key={t} className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground font-mono">{t}</span>
              ))}
              <span className="px-1.5 py-0.5 text-xs text-primary hover:underline">编辑...</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ Model Identity Panel ============
function ModelIdentityPanel({ config, defaults, onSave, onReset, onDirty, dirty }: any) {
  const [identity, setIdentity] = useState<Record<string, string>>(config.model_identity || {});
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');

  const updateIdentity = (prev: any, key: string, value: string) => {
    if (onDirty) onDirty();
    return { ...prev, [key]: value };
  };
  const removeIdentity = (prev: any, key: string) => {
    if (onDirty) onDirty();
    const n = { ...prev }; delete n[key]; return n;
  };
  const addIdentity = () => {
    if (newKey && newName) {
      setIdentity((prev: any) => { if (onDirty) onDirty(); return { ...prev, [newKey]: newName }; });
      setNewKey(''); setNewName('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Provider 显示名称映射。</p>
        <div className="flex gap-2">
          <button onClick={onReset} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground">恢复默认</button>
          <button onClick={() => onSave(identity)} disabled={!dirty} className={'px-3 py-1 text-xs rounded ' + (dirty ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed')}>保存</button>
        </div>
      </div>
      <div className="space-y-1.5">
        {Object.entries(identity).map(([key, name]: [string, any]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-28 text-sm font-mono text-right shrink-0">{key}</span>
            <input value={name} onChange={e => setIdentity((prev: any) => updateIdentity(prev, key, e.target.value))}
              className="flex-1 px-2 py-1 text-sm rounded bg-background border border-border" />
            <button onClick={() => setIdentity((prev: any) => removeIdentity(prev, key))} className="text-red-400 hover:text-red-500 text-xs px-1">x</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
        <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="provider" className="w-28 px-2 py-1 text-sm rounded bg-background border border-border" />
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="显示名称" className="flex-1 px-2 py-1 text-sm rounded bg-background border border-border" />
        <button onClick={addIdentity} className="px-3 py-1 text-xs rounded bg-green-600 text-white">添加</button>
      </div>
    </div>
  );
}

// ============ Patrol Config Panel ============
function PatrolConfigPanel({ config, defaults, onSave, onReset, onDirty, dirty }: any) {
  const [cfg, setCfg] = useState<any>(config.patrol_config || {});

  const updateCfg = (val: any) => {
    setCfg(val);
    if (onDirty) onDirty();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">巡检接口认证令牌及其他配置。</p>
        <div className="flex gap-2">
          <button onClick={onReset} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground">恢复默认</button>
          <button onClick={() => onSave(cfg)} disabled={!dirty} className={'px-3 py-1 text-xs rounded ' + (dirty ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed')}>保存</button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">巡检令牌</label>
          <input value={cfg.token || ''} onChange={e => updateCfg({ ...cfg, token: e.target.value })}
            className="px-2 py-1 text-sm rounded bg-background border border-border font-mono" type="text" />
        </div>
      </div>
    </div>
  );
}


