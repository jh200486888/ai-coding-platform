'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
      router.push('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
      title="退出登录"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">退出</span>
    </button>
  );
}
