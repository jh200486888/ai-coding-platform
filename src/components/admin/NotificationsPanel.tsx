'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, Wifi, WifiOff, Send, RefreshCw, Loader2, Trash2 } from 'lucide-react';

interface NotificationEvent {
  id: string;
  event: string;
  data: any;
  timestamp: string;
}

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
};

export default function NotificationsPanel() {
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

    // Listen for all known event types
    const eventTypes = ['tool_complete', 'job_started', 'job_complete', 'job_failed', 'task_complete', 'task_failed', 'document_generated', 'subagent_complete'];
    for (const type of eventTypes) {
      es.addEventListener(type, (e) => {
        const data = JSON.parse(e.data);
        addEvent(type, data);
      });
    }

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Auto-reconnect after 5s
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
      {/* 连接状态 + 统计 */}
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

      {/* 测试发送 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={testMessage}
          onChange={e => setTestMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleTestNotification(); }}
          placeholder="输入测试通知内容..."
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
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

      {/* 事件列表 */}
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
