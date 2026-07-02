"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, Heart, Clock, Bell, CheckCheck, TrendingUp, Zap } from "lucide-react";

interface HeartbeatLog {
  id: number;
  health: string;
  issues_count: number;
  issues: string[] | string;
  actions: string[] | string;
  tasks_executed: number;
  check_duration_ms: number;
  created_at: string;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  severity: string;
  acknowledged: boolean;
  created_at: string;
}

interface TrendPoint {
  hour: string;
  checks: number;
  ok: number;
  warnings: number;
  errors: number;
  avg_ms: number;
}

interface HeartbeatData {
  lastBeat: HeartbeatLog | null;
  stats24h: {
    total_checks: number;
    ok_count: number;
    warning_count: number;
    error_count: number;
    avg_duration_ms: number;
  } | null;
  trend: TrendPoint[];
  unacked: Notification[];
  recentLogs: HeartbeatLog[];
}

function parseJsonField(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return [val]; }
  }
  return [];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return mins + "分钟前";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "小时前";
  return Math.floor(hours / 24) + "天前";
}

function healthColor(health: string) {
  if (health === "ok") return "text-green-500";
  if (health === "warning") return "text-yellow-500";
  return "text-red-500";
}

function healthBg(health: string) {
  if (health === "ok") return "bg-green-500/10 border-green-500/20";
  if (health === "warning") return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function healthIcon(health: string) {
  if (health === "ok") return <CheckCircle2 size={18} className="text-green-500" />;
  if (health === "warning") return <AlertTriangle size={18} className="text-yellow-500" />;
  return <XCircle size={18} className="text-red-500" />;
}

function severityIcon(severity: string) {
  if (severity === "error") return <XCircle size={14} className="text-red-500" />;
  if (severity === "warning") return <AlertTriangle size={14} className="text-yellow-500" />;
  return <Activity size={14} className="text-blue-500" />;
}

export function HeartbeatPanel() {
  const [data, setData] = useState<HeartbeatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/heartbeat?type=overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Heartbeat fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchData]);

  const acknowledgeAll = async () => {
    await fetch("/api/admin/heartbeat?type=acknowledge_all");
    fetchData();
  };

  const acknowledgeOne = async (id: string) => {
    await fetch(`/api/admin/heartbeat?type=acknowledge&id=${id}`);
    fetchData();
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = data.stats24h;
  const last = data.lastBeat;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart size={20} className="text-red-500" />
          <h3 className="text-lg font-medium">心跳巡检</h3>
          {last && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${healthBg(last.health)}`}>
              {last.health === "ok" ? "正常" : last.health === "warning" ? "警告" : "异常"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${autoRefresh ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            <Zap size={12} className="inline mr-1" />{autoRefresh ? "自动刷新中" : "自动刷新"}
          </button>
          <button onClick={fetchData} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent">
            <RefreshCw size={12} className={`inline mr-1 ${loading ? "animate-spin" : ""}`} />刷新
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground">最近心跳</p>
          <div className="flex items-center gap-2 mt-1">
            {last ? healthIcon(last.health) : <Activity size={18} className="text-muted-foreground" />}
            <span className="text-sm font-medium">{last ? timeAgo(last.created_at) : "无数据"}</span>
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground">24h巡检次数</p>
          <p className="text-lg font-medium mt-1">{stats?.total_checks || 0}</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground">24h正常率</p>
          <p className="text-lg font-medium mt-1 text-green-500">
            {stats?.total_checks ? Math.round(((stats.ok_count || 0) / stats.total_checks) * 100) : 0}%
          </p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground">24h警告</p>
          <p className="text-lg font-medium mt-1 text-yellow-500">{stats?.warning_count || 0}</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground">24h异常</p>
          <p className="text-lg font-medium mt-1 text-red-500">{stats?.error_count || 0}</p>
        </div>
      </div>

      {/* Trend Chart - Simple bar chart */}
      {data.trend && data.trend.length > 0 && (
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> 24小时健康趋势
          </h4>
          <div className="flex items-end gap-1 h-24">
            {data.trend.map((point, i) => {
              const total = point.ok + point.warnings + point.errors;
              if (total === 0) return null;
              const okH = (point.ok / total) * 100;
              const warnH = (point.warnings / total) * 100;
              const errH = (point.errors / total) * 100;
              const hour = new Date(point.hour).getHours();
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full group relative" title={`${hour}:00 - 正常:${point.ok} 警告:${point.warnings} 异常:${point.errors}`}>
                  <div className="w-full flex flex-col" style={{ height: `${Math.max(okH, 5)}%` }}>
                    {point.errors > 0 && <div className="w-full bg-red-500/60" style={{ height: `${errH}%` }} />}
                    {point.warnings > 0 && <div className="w-full bg-yellow-500/60" style={{ height: `${warnH}%` }} />}
                    <div className="w-full bg-green-500/40 flex-1" />
                  </div>
                  <span className="text-[9px] text-muted-foreground text-center mt-1">{hour}h</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500/60" />正常</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500/60" />警告</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/60" />异常</span>
          </div>
        </div>
      )}

      {/* Unacknowledged Notifications */}
      {data.unacked && data.unacked.length > 0 && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Bell size={14} className="text-red-500" /> 待处理通知 ({data.unacked.length})
            </h4>
            <button onClick={acknowledgeAll} className="px-3 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <CheckCheck size={12} className="inline mr-1" />全部确认
            </button>
          </div>
          <div className="space-y-2">
            {data.unacked.map((n) => (
              <div key={n.id} className="flex items-start gap-2 p-2 rounded border border-border bg-card">
                {severityIcon(n.severity)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                <button onClick={() => acknowledgeOne(n.id)} className="text-xs text-muted-foreground hover:text-primary">
                  <CheckCheck size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Heartbeat Logs */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock size={14} /> 最近巡检记录
        </h4>
        {data.recentLogs && data.recentLogs.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.recentLogs.slice(0, 20).map((log) => {
              const issuesList = parseJsonField(log.issues);
              const actionsList = parseJsonField(log.actions);
              return (
                <div key={log.id} className="flex items-start gap-2 p-2 rounded border border-border text-xs">
                  {healthIcon(log.health)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={healthColor(log.health)}>{log.health === "ok" ? "正常" : log.health === "warning" ? "警告" : "异常"}</span>
                      <span className="text-muted-foreground">{timeAgo(log.created_at)}</span>
                      <span className="text-muted-foreground">{log.check_duration_ms}ms</span>
                    </div>
                    {issuesList.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {issuesList.map((issue, i) => (
                          <p key={i} className="text-red-400 truncate">{issue}</p>
                        ))}
                      </div>
                    )}
                    {actionsList.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {actionsList.map((action, i) => (
                          <p key={i} className="text-green-400 truncate">✓ {action}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无巡检记录，等待Cron触发（每5分钟）</p>
        )}
      </div>
    </div>
  );
}
