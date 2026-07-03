// ============================================
// 🚀 Next.js 16 Demo 布局
// ============================================
// 演示: 嵌套布局、导航组件、响应式设计

import Link from 'next/link';
import { ReactNode } from 'react';

export const metadata = {
  title: 'TaskFlow - Next.js 16 Demo',
  description: '基于Next.js 16 + React 19构建的全栈Demo应用',
};

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
    >
      {children}
    </Link>
  );
}

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/demo" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-bold shadow-lg shadow-purple-500/25">
                TF
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                TaskFlow
              </span>
            </Link>
            {/* 导航链接 */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/demo">仪表盘</NavLink>
              <NavLink href="/demo/tasks">任务列表</NavLink>
              <NavLink href="/demo/about">关于Demo</NavLink>
            </nav>
          </div>

          {/* 右側操作区 */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Next.js 16 + React 19
            </span>
            <Link
              href="/"
              className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              返回主站
            </Link>
          </div>
        </div>

        {/* 移动端导航 */}
        <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          <NavLink href="/demo">仪表盘</NavLink>
          <NavLink href="/demo/tasks">任务列表</NavLink>
          <NavLink href="/demo/about">关于Demo</NavLink>
        </nav>
      </header>

      {/* 主内容 */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* 页脚 */}
      <footer className="border-t border-border/50 bg-background/50 mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>TaskFlow Demo &copy; 2025 - 基于 Next.js 16 + React 19 构建</p>
            <p>展示全栈开发能力：路由、API、Server Actions、RSC</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
