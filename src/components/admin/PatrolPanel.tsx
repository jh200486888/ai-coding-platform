'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, Server, HardDrive, Cpu, Database, Clock, Zap } from 'lucide-react';

interface CheckResult {
  name: string;
  healthy: boolean;
  message: string;
  autoFixed?: boolean;
}

interface PatrolReport {
  timestamp: string;
  overall: 'healthy' | 'issues_found' | 'error';
  checks: CheckResult[];
  autoFixed: number;
}

const CHECK_ICONS: Record<string, React.ReactNode> = {
  HTTP: <Server size={16} />,
  PM2: <Activity size={16} />,
  Memory: <Cpu size={16} />,
  Disk: <HardDrive size={16} />,
  Database: <Database size={16} />,
};

export function PatrolPanel() {
  const [report, setReport] = useState<PatrolReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchPatrol = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/patrol?token=patrol-2026-secure');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Patrol fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatrol();
  }, [fetchPatrol]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchPatrol, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchPatrol]);

  const overallColor = report?.overall === 'healthy'
    ? 'text-green-500'
    : report?.overall === 'issues_found'
    ? 'text-yellow-500'
    : 'text-red-500';

  const overallLabel = report?.overall === 'healthy'
    ? '全部正常'
    : report?.overall === 'issues_found'
    ? '发现异常'
    : '巡检失败';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">系统巡检</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              autoRefresh
                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            <Zap size={12} /> {autoRefresh ? '自动刷新(30s)' : '自动刷新'}
          </button>
          <button
            onClick={fetchPatrol}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 立即巡检
          </button>
        </div>
      </div>

      {/* Overall Status */}
      {report && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            {report.overall === 'healthy' ? (
              <CheckCircle2 size={32} className="text-green-500" />
            ) : report.overall === 'issues_found' ? (
              <AlertTriangle size={32} className="text-yellow-500" />
            ) : (
              <XCircle size={32} className="text-red-500" />
            )}
            <div>
              <div className={`text-2xl font-bold ${overallColor}`}>{overallLabel}</div>
              <div className="text-xs text-muted-foreground">
                上次巡检: {new Date(report.timestamp).toLocaleString()}
              </div>
            </div>
          </div>

          {report.autoFixed > 0 && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600">
              ✅ 本次巡检自动修复了 {report.autoFixed} 个问题
            </div>
          )}

          {/* Check Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.checks.map((check) => (
              <div
                key={check.name}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  check.healthy
                    ? 'bg-green-500/5 border-green-500/10'
                    : 'bg-red-500/5 border-red-500/10'
                }`}
              >
                <div className={`mt-0.5 ${check.healthy ? 'text-green-500' : 'text-red-500'}`}>
                  {CHECK_ICONS[check.name] || <Activity size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{check.name}</span>
                    {check.healthy ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : (
                      <XCircle size={14} className="text-red-500" />
                    )}
                    {check.autoFixed && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">已自动修复</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {check.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center text-muted-foreground py-12">
          <Activity size={48} className="mx-auto mb-4 opacity-50" />
          <p>点击"立即巡检"检查系统健康状态</p>
        </div>
      )}

      {loading && !report && (
        <div className="text-center text-muted-foreground py-12">
          <RefreshCw size={32} className="mx-auto mb-4 animate-spin opacity-50" />
          <p className="text-sm">巡检中...</p>
        </div>
      )}

      {/* Patrol Info */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock size={14} /> 巡检说明
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>• 系统 <span className="text-foreground">每5分钟</span> 自动执行一次巡检（通过crontab定时调用）</p>
          <p>• 检查项：HTTP响应 / PM2进程 / 内存使用 / 磁盘空间 / 数据库连接</p>
          <p>• 发现PM2进程停止时会 <span className="text-green-500">自动重启</span> 修复</p>
          <p>• 巡检告警会自动记录到系统记忆，AI对话时可以获取最新状态</p>
          <p>• 巡检API: <code className="px-1.5 py-0.5 rounded bg-muted">/api/patrol?token=patrol-2026-secure</code></p>
        </div>
      </div>
    </div>
  );
}
