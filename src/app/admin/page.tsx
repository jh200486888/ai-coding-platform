import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { ModelManager } from '@/components/admin/ModelManager';
import { LogoutButton } from '@/components/admin/LogoutButton';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">后台管理</h1>
        </div>
        <LogoutButton />
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto p-6">
        <ModelManager />
      </main>
    </div>
  );
}
