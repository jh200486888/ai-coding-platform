import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { getSetting } from '@/lib/db';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#7c3aed',
};

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
        <Script id="null-guard" strategy="beforeInteractive">{`
          (function(){
            var oe=window.onerror;
            window.onerror=function(m,u,l,c,e){
              if(m&&typeof m==='string'&&m.indexOf('null')!==-1&&m.indexOf('length')!==-1){
                console.warn('[NULL-GUARD] Suppressed:',m,'at',u,':',l);
                try{fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'null_guard',message:m,url:u,line:l,stack:e?e.stack:'none',page:location.href,t:Date.now()})}).catch(function(){});}catch(x){}
                return true;
              }
              if(oe)return oe(m,u,l,c,e);
              return false;
            };
            window.addEventListener('unhandledrejection',function(e){
              var m=e.reason&&(e.reason.message||String(e.reason));
              if(m&&m.indexOf('null')!==-1&&m.indexOf('length')!==-1){
                console.warn('[NULL-GUARD] Suppressed rejection:',m);
                e.preventDefault();
              }
            });
            var ce=console.error;
            console.error=function(){
              var a=Array.prototype.slice.call(arguments);
              var s=a.map(function(x){return typeof x==='string'?x:'';}).join(' ');
              if(s.indexOf('null')!==-1&&s.indexOf('length')!==-1){
                console.warn.apply(console,['[NULL-GUARD]'].concat(a));
                return;
              }
              ce.apply(console,a);
            };
          })();
        `}</Script>
      </body>
    </html>
  );
}
