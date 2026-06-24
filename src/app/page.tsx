import { ChatInterface } from '@/components/chat/ChatInterface';
import Link from 'next/link';
import { Code2, MessageSquare, Palette } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航栏 - 响应式 */}
      <header className="flex items-center justify-between px-3 py-3 md:px-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-base md:text-lg font-semibold truncate">AI 编程平台</h1>
        </div>
        <nav className="flex items-center gap-1 md:gap-2">
          <Link
            href="/image-gen"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs md:text-sm font-medium rounded-md hover:bg-muted transition-colors"
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">图片生成</span>
          </Link>
          <Link
            href="/workspace"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs md:text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Code2 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">编程工作区</span>
          </Link>
        </nav>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        <ChatInterface />
      </main>
    </div>
  );
}
