'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, RefreshCw, Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Job {
  id: string;
  job_type: string;
  title: string;
  payload: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  result?: string;
  error?: string;
  progress: number;
  max_retries: number;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '等待中', color: 'text-yellow-500 bg-yellow-500/10', icon: Clock },
  running: { label: '执行中', color: 'text-blue-500 bg-blue-500/10', icon: Loader2 },
  completed: { label: '已完成', color: 'text-green-500 bg-green-500/10', icon: CheckCircle2 },
  failed: { label: '失败', color: 'text-red-500 bg-red-500/10', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-500 bg-gray-500/10', icon: AlertCircle },
};

export default function BackgroundJobsPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [actionLoading, setActionLoading] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const url = filter ? `/api/admin/jobs?status=${filter}&limit=100` : '/api/admin/jobs?limit=100';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id }),
      });
      fetchJobs();
    } catch {}
    setActionLoading('');
  };

  const handleEnqueue = async () => {
    setActionLoading('enqueue');
    try {
      await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enqueue',
          job_type: 'chat_task',
          title: '手动测试任务',
          payload: { message: '你好，请简要介绍自己', model: 'deepseek-chat', mode: 'chat' },
        }),
      });
      fetchJobs();
    } catch {}
    setActionLoading('');
  };

  const formatTime = (t?: string) => {
    if (!t) return '-';
    return new Date(t).toLocaleString('zh-CN', { hour12: false });
  };

  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '总计', value: stats.total, color: 'text-foreground' },
          { label: '等待中', value: stats.pending, color: 'text-yellow-500' },
          { label: '执行中', value: stats.running, color: 'text-blue-500' },
          { label: '已完成', value: stats.completed, color: 'text-green-500' },
          { label: '失败', value: stats.failed, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {['', 'pending', 'running', 'completed', 'failed', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filter === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === '' ? '全部' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
        <button onClick={fetchJobs} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors" title="刷新">
          <RefreshCw size={16} />
        </button>
        <button
          onClick={handleEnqueue}
          disabled={actionLoading === 'enqueue'}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Play size={14} />
          创建测试任务
        </button>
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="mx-auto mb-3" size={40} />
          <p>暂无后台任务</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div
                key={job.id}
                className={`bg-card border rounded-lg p-3 cursor-pointer transition-all hover:border-primary/30 ${selectedJob?.id === job.id ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}
                onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${cfg.color}`}>
                    <Icon size={14} className={job.status === 'running' ? 'animate-spin' : ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{job.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{job.job_type}</span>
                      <span>优先级: {job.priority}</span>
                      {job.retry_count > 0 && <span className="text-orange-500">重试 {job.retry_count}/{job.max_retries}</span>}
                      <span>{formatTime(job.created_at)}</span>
                    </div>
                  </div>
                  {(job.status === 'running' || job.status === 'completed') && (
                    <div className="w-20">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right mt-0.5">{job.progress}%</div>
                    </div>
                  )}
                  {(job.status === 'pending' || job.status === 'running') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(job.id); }}
                      disabled={actionLoading === job.id}
                      className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors"
                      title="取消任务"
                    >
                      <Square size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 任务详情 */}
      {selectedJob && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">任务详情</h3>
            <span className="text-xs text-muted-foreground font-mono">{selectedJob.id}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">类型: </span>{selectedJob.job_type}</div>
            <div><span className="text-muted-foreground">状态: </span>{STATUS_CONFIG[selectedJob.status]?.label}</div>
            <div><span className="text-muted-foreground">创建: </span>{formatTime(selectedJob.created_at)}</div>
            <div><span className="text-muted-foreground">开始: </span>{formatTime(selectedJob.started_at)}</div>
            <div><span className="text-muted-foreground">完成: </span>{formatTime(selectedJob.completed_at)}</div>
            <div><span className="text-muted-foreground">进度: </span>{selectedJob.progress}%</div>
            <div><span className="text-muted-foreground">重试: </span>{selectedJob.retry_count}/{selectedJob.max_retries}</div>
            <div><span className="text-muted-foreground">优先级: </span>{selectedJob.priority}</div>
          </div>
          {selectedJob.payload && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Payload</summary>
              <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-x-auto max-h-32">{JSON.stringify(selectedJob.payload, null, 2)}</pre>
            </details>
          )}
          {selectedJob.error && (
            <div className="text-xs">
              <span className="text-red-500 font-medium">错误: </span>
              <pre className="mt-1 p-2 bg-red-500/5 border border-red-500/20 rounded text-[11px] text-red-400 overflow-x-auto max-h-32">{selectedJob.error}</pre>
            </div>
          )}
          {selectedJob.result && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">执行结果</summary>
              <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">{selectedJob.result}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
