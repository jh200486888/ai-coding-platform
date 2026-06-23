import { ChatInterface } from '@/components/chat/ChatInterface';
import Link from 'next/link';
import { Code2, MessageSquare, Settings, Palette } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">AI 编程平台</h1>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/image-gen"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
          >
            <Palette className="w-4 h-4" />
            图片生成
          </Link>
          <Link
            href="/workspace"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Code2 className="w-4 h-4" />
            编程工作区
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            后台管理
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
