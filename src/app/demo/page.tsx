// ============================================
// 🚀 Next.js 16 Server Component 演示
// ============================================
// 演示: 服务端组件直接获取数据、RSC特性

import Link from 'next/link';
import { DemoStats } from './_components/demo-stats';
import { RecentTasks } from './_components/recent-tasks';
import { FrameworkHighlights } from './_components/framework-highlights';

// 服务端组件：直接获取数据
async function getStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
    const res = await fetch(`${baseUrl}/api/demo/tasks`, {
      cache: 'no-store',
    });
    if (!res.ok) return { total: 0, todo: 0, inProgress: 0, done: 0 };
    const data = await res.json();
    const tasks = data.data || [];
    return {
      total: tasks.length,
      todo: tasks.filter((t: any) => t.status === 'todo').length,
      inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
      done: tasks.filter((t: any) => t.status === 'done').length,
    };
  } catch {
    return { total: 0, todo: 0, inProgress: 0, done: 0 };
  }
}

export default async function DemoHomePage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">TaskFlow 仪表盘</h1>
        <p className="text-muted-foreground">
          基于 <strong>Next.js 16</strong> + <strong>React 19</strong> 的全栈Demo应用，
          展示现代Web开发的核心特性。
        </p>
      </div>

      {/* 统计卡片 */}
      <DemoStats stats={stats} />

      {/* 主要内容网格 */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* 最近任务 - 占2列 */}
        <div className="lg:col-span-2">
          <RecentTasks />
        </div>
        {/* 框架亮点 - 占1列 */}
        <div className="lg:col-span-1">
          <FrameworkHighlights />
        </div>
      </div>

      {/* 快速入口 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">🚀 快速开始</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/demo/tasks"
            className="group rounded-lg border border-border bg-muted/30 p-4 hover:bg-accent transition-all hover:border-primary/50"
          >
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-medium group-hover:text-primary transition-colors">浏览任务</h3>
            <p className="text-xs text-muted-foreground mt-1">查看所有任务列表和管理状态</p>
          </Link>
          <Link
            href="/demo/tasks?status=todo"
            className="group rounded-lg border border-border bg-muted/30 p-4 hover:bg-accent transition-all hover:border-primary/50"
          >
            <div className="text-2xl mb-2">➕</div>
            <h3 className="font-medium group-hover:text-primary transition-colors">创建任务</h3>
            <p className="text-xs text-muted-foreground mt-1">通过API提交新任务到系统</p>
          </Link>
          <a
            href="/api/demo/tasks"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-border bg-muted/30 p-4 hover:bg-accent transition-all hover:border-primary/50"
          >
            <div className="text-2xl mb-2">🔌</div>
            <h3 className="font-medium group-hover:text-primary transition-colors">API 测试</h3>
            <p className="text-xs text-muted-foreground mt-1">直接访问RESTful API接口</p>
          </a>
        </div>
      </div>
    </div>
  );
}
