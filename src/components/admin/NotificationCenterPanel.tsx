'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Bell, BellRing, Wifi, WifiOff, Send, RefreshCw, Loader2, Trash2,
  Save, Plus, MessageSquare, Settings, Radio, Shield,
} from 'lucide-react';

// ============ Types ============
type SubTab = 'im-config' | 'event-monitor';

interface WebhookItem {
  type: 'dingtalk' | 'feishu' | 'wechat' | 'custom';
  url: string;
  secret: string;
  enabled: boolean;
  label: string;
}

interface NotificationEvent {
  id: string;
  event: string;
  data: any;
  timestamp: string;
}

const WEBHOOK_TYPES = [
  { type: 'dingtalk' as const, label: '钉钉群', placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
  { type: 'feishu' as const, label: '飞书群', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
  { type: 'wechat' as const, label: '企业微信', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' },
  { type: 'custom' as const, label: '自定义Webhook', placeholder: 'https://...' },
];

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  connected: { label: '连接成功', color: 'text-green-500' },
  tool_complete: { label: '工具完成', color: 'text-blue-500' },
  job_started: { label: '任务开始', color: 'text-yellow-500' },
  job_complete: { label: '任务完成', color: 'text-green-500' },
  job_failed: { label: '任务失败', color: 'text-red-500' },
  task_complete: { label: '定时任务完成', color: 'text-green-500' },
  task_failed: { label: '定时任务失败', color: 'text-red-500' },
  document_generated: { label: '文档生成', color: 'text-purple-500' },
  subagent_complete: { label: '子智能体完成', color: 'text-cyan-500' },
  patrol_alert: { label: '巡检告警', color: 'text-orange-500' },
};

const IM_PUSH_EVENTS = [
  { key: 'task_complete', label: '定时任务完成', defaultEnabled: false },
  { key: 'task_failed', label: '定时任务失败', defaultEnabled: true },
  { key: 'job_failed', label: '后台任务失败', defaultEnabled: true },
  { key: 'subagent_complete', label: '子智能体完成', defaultEnabled: false },
  { key: 'patrol_alert', label: '巡检告警', defaultEnabled: true },
];

// ============ IM Config Tab ============
function ImConfigTab() {
  const [config, setConfig] = useState<{ enabled: boolean; webhooks: WebhookItem[]; imEvents?: string[] }>({
    enabled: false,
    webhooks: [],
    imEvents: IM_PUSH_EVENTS.filter(e => e.defaultEnabled).map(e => e.key),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch('/api/admin/platform-config?key=notification_config')
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          const parsed = JSON.parse(data.value);
          // Ensure all 4 types exist
          const existing: WebhookItem[] = parsed.webhooks || [];
          const ensured = WEBHOOK_TYPES.map(wt => {
            const found = existing.find(w => w.type === wt.type);
            return found || { type: wt.type, url: '', secret: '', enabled: false, label: wt.label };
          });
          setConfig({
            enabled: parsed.enabled ?? false,
            webhooks: ensured,
            imEvents: parsed.imEvents || IM_PUSH_EVENTS.filter(e => e.defaultEnabled).map(e => e.key),
          });
        } else {
          setConfig({
            enabled: false,
            webhooks: WEBHOOK_TYPES.map(wt => ({ type: wt.type, url: '', secret: '', enabled: false, label: wt.label })),
            imEvents: IM_PUSH_EVENTS.filter(e => e.defaultEnabled).map(e => e.key),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateWebhook = (idx: number, field: string, val: any) => {
    setConfig(prev => {
      const wh = [...prev.webhooks];
      wh[idx] = { ...wh[idx], [field]: val };
      return { ...prev, webhooks: wh };
    });
    setDirty(true);
  };

  const toggleImEvent = (key: string) => {
    setConfig(prev => {
      const events = prev.imEvents || [];
      const next = events.includes(key) ? events.filter(e => e !== key) : [...events, key];
      return { ...prev, imEvents: next };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'notification_config', value: JSON.stringify(config) }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setDirty(false);
        toast.success('通知配置已保存');
      } else {
        toast.error('保存失败: ' + (data.error || ''));
      }
    } catch {
      toast.error('保存请求失败');
    }
    setSaving(false);
  };

  const handleTest = async (idx: number) => {
    const wh = config.webhooks[idx];
    if (!wh.url) { toast.error('请先填写 Webhook 地址'); return; }
    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wh),
      });
      const data = await res.json();
      data.success ? toast.success('测试消息发送成功!') : toast.error('发送失败: ' + (data.error || ''));
    } catch {
      toast.error('请求失败');
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>;

  return (
    <div className="space-y-5">
      {/* Global toggle + save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => { setConfig(prev => ({ ...prev, enabled: e.target.checked })); setDirty(true); }}
            className="w-4 h-4"
            id="nc-enabled"
          />
          <label htmlFor="nc-enabled" className="text-sm font-medium">启用 IM 告警通知</label>
          <span className="text-xs text-muted-foreground">巡检/任务异常时自动推送到 IM 群</span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-orange-500">● 未保存</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            保存配置
          </button>
        </div>
      </div>

      {/* Webhook cards */}
      <div className="space-y-3">
        {config.webhooks.map((wh, idx) => {
          const typeInfo = WEBHOOK_TYPES.find(t => t.type === wh.type);
          return (
            <div key={wh.type} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={wh.enabled}
                    onChange={e => updateWebhook(idx, 'enabled', e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-sm font-medium">{wh.label || wh.type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{wh.type}</span>
                </div>
                <button
                  onClick={() => handleTest(idx)}
                  disabled={!wh.url || !wh.enabled}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={10} /> 测试
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Webhook URL</label>
                  <input
                    value={wh.url}
                    onChange={e => updateWebhook(idx, 'url', e.target.value)}
                    placeholder={typeInfo?.placeholder || 'https://...'}
                    className="w-full text-xs px-2.5 py-2 border border-border rounded-lg bg-background focus:border-primary outline-none transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {wh.type === 'dingtalk' ? '加签密钥 (可选)' : '密钥 (可选)'}
                  </label>
                  <input
                    value={wh.secret || ''}
                    onChange={e => updateWebhook(idx, 'secret', e.target.value)}
                    placeholder="留空则不签名"
                    type="password"
                    className="w-full text-xs px-2.5 py-2 border border-border rounded-lg bg-background focus:border-primary outline-none transition-colors font-mono"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* IM Push Event Rules */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Radio size={14} /> 事件推送规则
          </h4>
          <p className="text-xs text-muted-foreground mt-1">勾选需要推送到 IM 通道的事件类型</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {IM_PUSH_EVENTS.map(evt => (
            <label
              key={evt.key}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={(config.imEvents || []).includes(evt.key)}
                onChange={() => toggleImEvent(evt.key)}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs">{evt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Event Monitor Tab (SSE) ============
function EventMonitorTab() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [testMessage, setTestMessage] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource('/api/notifications/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', (e) => {
      setConnected(true);
      const data = JSON.parse(e.data);
      addEvent('connected', data);
    });

    const eventTypes = ['tool_complete', 'job_started', 'job_complete', 'job_failed', 'task_complete', 'task_failed', 'document_generated', 'subagent_complete', 'patrol_alert'];
    for (const type of eventTypes) {
      es.addEventListener(type, (e) => {
        const data = JSON.parse(e.data);
        addEvent(type, data);
      });
    }

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(() => connect(), 5000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { eventSourceRef.current?.close(); };
  }, [connect]);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const addEvent = (event: string, data: any) => {
    setEvents(prev => [...prev.slice(-199), {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      event,
      data,
      timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
    }]);
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage || '这是一条测试通知' }),
      });
      if (!res.ok) {
        addEvent('test', { message: '发送失败: HTTP ' + res.status, success: false });
      }
    } catch (e: any) {
      addEvent('test', { message: '发送失败: ' + e.message, success: false });
    }
    setTestLoading(false);
    setTestMessage('');
  };

  const clearEvents = () => setEvents([]);

  const eventCounts = events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Connection status + stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${connected ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'SSE 已连接' : '未连接（5秒后重连）'}
        </div>
        <div className="text-xs text-muted-foreground">
          共 {events.length} 条事件
          {Object.entries(eventCounts).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} className="ml-2">
              <span className={EVENT_LABELS[k]?.color || 'text-muted-foreground'}>{EVENT_LABELS[k]?.label || k}</span>: {v}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="rounded" />
            自动滚动
          </label>
          <button onClick={clearEvents} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors" title="清空">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Test send */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={testMessage}
          onChange={e => setTestMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleTestNotification(); }}
          placeholder="输入测试通知内容..."
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={handleTestNotification}
          disabled={testLoading}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          发送测试
        </button>
      </div>

      {/* Event list */}
      <div ref={listRef} className="bg-card border border-border rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="mx-auto mb-3" size={40} />
            <p>暂无通知事件</p>
            <p className="text-xs mt-1">连接 SSE 后将实时接收系统事件</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map(evt => {
              const cfg = EVENT_LABELS[evt.event] || { label: evt.event, color: 'text-muted-foreground' };
              return (
                <div key={evt.id} className="px-4 py-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <BellRing size={12} className={cfg.color} />
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{evt.timestamp}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {evt.data?.title && <span className="text-foreground">{evt.data.title}</span>}
                    {evt.data?.tool && <span className="ml-1 text-blue-400">[{evt.data.tool}]</span>}
                    {evt.data?.message && <span>{evt.data.message}</span>}
                    {evt.data?.error && <span className="text-red-400">{evt.data.error}</span>}
                    {evt.data?.jobId && <span className="ml-1 font-mono text-[10px]">{evt.data.jobId.slice(0, 8)}</span>}
                    {evt.data?.clientId && <span className="ml-1 font-mono text-[10px]">{evt.data.clientId}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Main Panel ============
export default function NotificationCenterPanel() {
  const [subTab, setSubTab] = useState<SubTab>('im-config');

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'im-config', label: 'IM 通道配置', icon: <MessageSquare size={14} /> },
    { key: 'event-monitor', label: '实时事件监控', icon: <Radio size={14} /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell size={20} /> 通知中心
          </h2>
          <p className="text-xs text-muted-foreground mt-1">统一管理 IM 通道配置和实时事件监控</p>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-5 border-b border-border pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
              (subTab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground')
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {subTab === 'im-config' && <ImConfigTab />}
      {subTab === 'event-monitor' && <EventMonitorTab />}
    </div>
  );
}
