import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 编程平台',
  description: '多模型 AI 对话、编程工作区与图片生成',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
