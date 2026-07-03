// ============================================
// 🚀 最近任务组件 - 客户端组件(useEffect)
// ============================================
// 演示: 客户端数据获取、交互式UI

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

const statusMap = {
  todo: { label: '待处理', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  in_progress: { label: '进行中', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  done: { label: '已完成', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
};

const priorityMap = {
  low: { label: '低', color: 'bg-gray-500/10 text-gray-500' },
  medium: { label: '中', color: 'bg-blue-500/10 text-blue-500' },
  high: { label: '高', color: 'bg-red-500/10 text-red-500' },
};

export function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/demo/tasks');
      if (!res.ok) throw new Error('获取任务失败');
      const data = await res.json();
      setTasks(data.data?.slice(0, 5) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">📋 最近任务</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">📋 最近任务</h2>
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          <p>❌ {error}</p>
          <button
            onClick={fetchTasks}
            className="mt-2 text-sm underline hover:no-underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">📋 最近任务</h2>
        <Link
          href="/demo/tasks"
          className="text-xs text-primary hover:underline"
        >
          查看全部 →
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">暂无任务</p>
          <p className="text-xs text-muted-foreground mt-1">
            通过API创建新任务
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/demo/tasks/${task.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border/50 p-3 hover:bg-accent/50 transition-all hover:border-primary/30"
            >
              {/* 状态指示器 */}
              <div className="flex-shrink-0">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  task.status === 'done' ? 'bg-green-500' :
                  task.status === 'in_progress' ? 'bg-purple-500' :
                  'bg-yellow-500'
                }`} />
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {task.description || '无描述'}
                </p>
              </div>

              {/* 标签 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusMap[task.status].color}`}>
                  {statusMap[task.status].label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${priorityMap[task.priority].color}`}>
                  {priorityMap[task.priority].label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
