'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(data.error || '登录失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">管理员登录</h1>
            <p className="text-sm text-muted-foreground mt-1">请输入管理员账号和密码</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
