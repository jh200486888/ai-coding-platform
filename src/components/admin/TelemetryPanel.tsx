'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, Clock, AlertCircle, BarChart3, RefreshCw } from 'lucide-react';

interface TelemetryStats {
  period: string;
  overall: {
    totalCalls: number;
    successCalls: number;
    successRate: number;
    avgDuration: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
  };
  byProvider: Array<{
    provider: string;
    count: number;
    avg_duration: number;
    total_tokens: number;
    success_count: number;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    count: number;
    avg_duration: number;
    total_tokens: number;
  }>;
  hourlyTrend: Array<{
    hour: string;
    count: number;
    avg_duration: number;
    tokens: number;
  }>;
  errors: Array<{
    error_code: string;
    count: number;
    model: string;
    provider: string;
  }>;
}

export function TelemetryPanel() {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/admin/telemetry?type=stats&hours=${hours}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [hours]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin" size={24} />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-12 text-muted-foreground">暂无数据</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">AI 调用监控</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm"
          >
            <option value={1}>最近 1 小时</option>
            <option value={6}>最近 6 小时</option>
            <option value={24}>最近 24 小时</option>
            <option value={168}>最近 7 天</option>
            <option value={720}>最近 30 天</option>
          </select>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp size={16} />}
          label="总调用次数"
          value={stats.overall?.totalCalls ?? 0}
        />
        <StatCard
          icon={<Activity size={16} />}
          label="成功率"
          value={`${stats.overall?.successRate ?? 0}%`}
          subValue={`${stats.overall?.successCalls ?? 0}/${stats.overall?.totalCalls ?? 0}`}
        />
        <StatCard
          icon={<Clock size={16} />}
          label="平均耗时"
          value={`${stats.overall?.avgDuration ?? 0}ms`}
        />
        <StatCard
          icon={<BarChart3 size={16} />}
          label="Token 消耗"
          value={formatNumber(stats.overall?.totalTokens ?? 0)}
          subValue={`输入 ${formatNumber(stats.overall?.totalPromptTokens ?? 0)} / 输出 ${formatNumber(stats.overall?.totalCompletionTokens ?? 0)}`}
        />
      </div>

      {/* Provider Stats */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 size={16} />
          各 Provider 调用情况
        </h3>
        <div className="space-y-2">
          {(stats.byProvider || []).map((p) => (
            <div key={p.provider} className="flex items-center justify-between p-2 rounded hover:bg-accent/50">
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{p.provider}</span>
                <span className="text-xs text-muted-foreground">{p.count} 次</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>成功率 {Math.round((p.success_count / p.count) * 100)}%</span>
                <span>平均 {Math.round(p.avg_duration)}ms</span>
                <span>{formatNumber(p.total_tokens)} tokens</span>
              </div>
            </div>
          ))}
          {(stats.byProvider || []).length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">暂无数据</div>
          )}
        </div>
      </div>

      {/* Top Models */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Top 10 模型</h3>
        <div className="space-y-2">
          {(stats.byModel || []).map((m) => (
            <div key={m.model} className="flex items-center justify-between p-2 rounded hover:bg-accent/50">
              <div>
                <div className="text-sm font-medium">{m.model}</div>
                <div className="text-xs text-muted-foreground">{m.provider}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{m.count} 次</div>
                <div>{formatNumber(m.total_tokens)} tokens</div>
              </div>
            </div>
          ))}
          {(stats.byModel || []).length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">暂无数据</div>
          )}
        </div>
      </div>

      {/* Errors */}
      {(stats.errors || []).length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-destructive">
            <AlertCircle size={16} />
            错误记录
          </h3>
          <div className="space-y-2">
            {(stats.errors || []).map((e, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/5">
                <div>
                  <span className="text-sm font-mono">{e.error_code}</span>
                  <span className="text-xs text-muted-foreground ml-2">{e.provider} / {e.model}</span>
                </div>
                <span className="text-sm text-destructive">{e.count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-muted-foreground text-center">
        数据自动保留 7 天，超期自动清理
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
