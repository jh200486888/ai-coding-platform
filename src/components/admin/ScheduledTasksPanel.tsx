import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Play, Pause, Save, RefreshCw, Clock, Zap, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledTask {
  id: string;
  conversation_id?: string;
  task_name: string;
  task_description: string;
  cron_expression: string;
  next_run_at: string | null;
  last_run_at: string | null;
  status: 'active' | 'paused' | 'completed' | 'failed';
  run_count: number;
  max_runs?: number;
  result_summary?: string;
  created_at: string;
  updated_at: string;
}

const CRON_PRESETS = [
  { label: '每30分钟', value: 'every_N_minutes:30' },
  { label: '每1小时', value: 'every_N_hours:1' },
  { label: '每2小时', value: 'every_N_hours:2' },
  { label: '每6小时', value: 'every_N_hours:6' },
  { label: '每天09:00', value: 'daily:09:00' },
  { label: '每天18:00', value: 'daily:18:00' },
  { label: '每周一10:00', value: 'weekly:mon:10:00' },
  { label: '每周五17:00', value: 'weekly:fri:17:00' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '活跃', color: 'bg-green-500/20 text-green-400' },
  paused: { label: '暂停', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: '已完成', color: 'bg-blue-500/20 text-blue-400' },
  failed: { label: '失败', color: 'bg-red-500/20 text-red-400' },
};

function formatCron(expr: string): string {
  if (expr.startsWith('every_N_minutes:')) return `每${expr.split(':')[1]}分钟`;
  if (expr.startsWith('every_N_hours:')) return `每${expr.split(':')[1]}小时`;
  if (expr.startsWith('daily:')) return `每天 ${expr.split(':')[1]}:${expr.split(':')[2] || '00'}`;
  if (expr.startsWith('weekly:')) {
    const dayMap: Record<string, string> = { mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六', sun: '日' };
    const parts = expr.split(':');
    return `每周${dayMap[parts[1]] || parts[1]} ${parts[2] || '10'}:${parts[3] || '00'}`;
  }
  return expr;
}

export function ScheduledTasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ task_name: '', task_description: '', cron_expression: 'every_N_hours:1', max_runs: '' });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTasks = useCallback(async (showFeedback: boolean = false) => {
    if (showFeedback) setRefreshing(true);
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.data) setTasks(data.data);
      if (showFeedback) toast.success('任务列表已刷新');
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      if (showFeedback) toast.error('刷新失败');
    } finally {
      if (showFeedback) setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.task_name || !form.task_description || !form.cron_expression) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_name: form.task_name,
          task_description: form.task_description,
          cron_expression: form.cron_expression,
          max_runs: form.max_runs ? parseInt(form.max_runs) : null,
          status: 'active',
        }),
      });
      const data = await res.json();
      if (data.data || data.success) {
        setForm({ task_name: '', task_description: '', cron_expression: 'every_N_hours:1', max_runs: '' });
        setShowForm(false);
        await fetchTasks();
        toast.success('任务已创建');
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch (err) {
      toast.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此定时任务吗？')) return;
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      await fetchTasks();
      toast.success('任务已删除');
    } catch (err) {
      toast.error('删除失败');
    }
  };

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'trigger') => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTasks();
        const msgs = { pause: '任务已暂停', resume: '任务已恢复', trigger: '已标记立即执行' };
        toast.success(msgs[action]);
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (err) {
      toast.error('操作失败');
    }
  };

  const activeCount = tasks.filter(t => t.status === 'active').length;
  const pausedCount = tasks.filter(t => t.status === 'paused').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">定时任务</h2>
          <p className="text-xs text-muted-foreground mt-1">
            共 {tasks.length} 个任务 · {activeCount} 活跃 · {pausedCount} 暂停
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTasks(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "刷新中..." : "刷新"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
          >
            <Plus size={14} /> 新建任务
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <input
            placeholder="任务名称（如：每小时检查PM2状态）"
            value={form.task_name}
            onChange={(e) => setForm({ ...form, task_name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <textarea
            placeholder="任务描述（AI会根据此描述执行，如：检查PM2进程列表，如有进程stopped则尝试重启并报告）"
            value={form.task_description}
            onChange={(e) => setForm({ ...form, task_description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-muted-foreground shrink-0">执行频率</label>
            <select
              value={CRON_PRESETS.some(p => p.value === form.cron_expression) ? form.cron_expression : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') setForm({ ...form, cron_expression: e.target.value });
              }}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            >
              {CRON_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">自定义...</option>
            </select>
            <input
              placeholder="自定义cron表达式（如 every_N_minutes:15）"
              value={form.cron_expression}
              onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground shrink-0">最大执行次数</label>
            <input
              type="number"
              placeholder="留空=无限"
              value={form.max_runs}
              onChange={(e) => setForm({ ...form, max_runs: e.target.value })}
              className="w-32 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">留空表示不限制执行次数</span>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !form.task_name || !form.task_description}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={14} /> {loading ? '创建中...' : '创建任务'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{task.task_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_MAP[task.status]?.color || 'bg-muted text-muted-foreground'}`}>
                      {STATUS_MAP[task.status]?.label || task.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {formatCron(task.cron_expression)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.task_description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <RotateCcw size={12} />
                      已执行 {task.run_count} 次{task.max_runs ? ` / ${task.max_runs}次` : ''}
                    </span>
                    {task.next_run_at && task.status === 'active' && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        下次: {new Date(task.next_run_at).toLocaleString()}
                      </span>
                    )}
                    {task.last_run_at && (
                      <span>上次: {new Date(task.last_run_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {task.status === 'active' && (
                    <button onClick={() => handleAction(task.id, 'pause')} className="p-2 rounded-lg hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-500 transition-colors" title="暂停">
                      <Pause size={16} />
                    </button>
                  )}
                  {task.status === 'paused' && (
                    <button onClick={() => handleAction(task.id, 'resume')} className="p-2 rounded-lg hover:bg-green-500/10 text-muted-foreground hover:text-green-500 transition-colors" title="恢复">
                      <Play size={16} />
                    </button>
                  )}
                  {task.status === 'active' && (
                    <button onClick={() => handleAction(task.id, 'trigger')} className="p-2 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors" title="立即执行">
                      <Zap size={16} />
                    </button>
                  )}
                  <button onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors" title={expandedId === task.id ? '收起' : '查看详情'}>
                    <Clock size={16} />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
            {expandedId === task.id && (
              <div className="border-t border-border p-4 bg-background/30">
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">任务ID：</span><span className="font-mono text-xs">{task.id}</span></div>
                  <div><span className="text-muted-foreground">Cron表达式：</span><span className="font-mono">{task.cron_expression}</span></div>
                  {task.conversation_id && <div><span className="text-muted-foreground">关联对话：</span><span className="font-mono text-xs">{task.conversation_id}</span></div>}
                  {task.result_summary && (
                    <div>
                      <span className="text-muted-foreground">最近执行结果：</span>
                      <p className="mt-1 text-xs bg-background rounded-lg p-2 border border-border max-h-32 overflow-y-auto whitespace-pre-wrap">{task.result_summary}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    创建: {new Date(task.created_at).toLocaleString()} · 更新: {new Date(task.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>暂无定时任务</p>
            <p className="text-sm mt-2">点击"新建任务"创建第一个定时任务，或在对话中使用 schedule_task 工具</p>
          </div>
        )}
      </div>
    </div>
  );
}
