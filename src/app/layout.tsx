import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { getSetting } from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteTitle = await getSetting('site_title');
    const siteDescription = await getSetting('site_description');
    return {
      title: siteTitle || 'AI 编程平台',
      description: siteDescription || '多模型 AI 对话、编程工作区与图片生成',
    };
  } catch {
    return {
      title: 'AI 编程平台',
      description: '多模型 AI 对话、编程工作区与图片生成',
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
