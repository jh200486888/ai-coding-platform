import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Play, Pause, Save, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  nextRunAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ScheduledTasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', prompt: '', runIn: '1h' });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!form.title || !form.prompt) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.data) {
        setForm({ title: '', prompt: '', runIn: '1h' });
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

  const handleToggle = async (task: ScheduledTask) => {
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, isActive: !task.isActive }),
      });
      await fetchTasks();
      toast.success(task.isActive ? '任务已暂停' : '任务已激活');
    } catch (err) {
      toast.error('操作失败');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">定时任务</h2>
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
            placeholder="任务标题"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
          <textarea
            placeholder="任务内容 / Prompt"
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">执行间隔</label>
            <select
              value={form.runIn}
              onChange={(e) => setForm({ ...form, runIn: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            >
              <option value="30m">30 分钟</option>
              <option value="1h">1 小时</option>
              <option value="2h">2 小时</option>
              <option value="1d">明天</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !form.title || !form.prompt}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={14} /> {loading ? '创建中...' : '创建任务'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{task.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${task.isActive ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {task.isActive ? '活跃' : '暂停'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.prompt}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  {task.nextRunAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      下次执行: {new Date(task.nextRunAt).toLocaleString()}
                    </span>
                  )}
                  <span>创建: {new Date(task.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggle(task)}
                  className={`p-2 rounded-lg transition-colors ${task.isActive ? 'hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-500' : 'hover:bg-green-500/10 text-muted-foreground hover:text-green-500'}`}
                  title={task.isActive ? '暂停' : '激活'}
                >
                  {task.isActive ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>暂无定时任务</p>
            <p className="text-sm mt-2">点击"新建任务"创建第一个定时任务</p>
          </div>
        )}
      </div>
    </div>
  );
}
