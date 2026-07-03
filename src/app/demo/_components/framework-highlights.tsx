// ============================================
// 🚀 框架亮点组件 - 展示Next.js 16特性
// ============================================

const highlights = [
  {
    icon: '⚛️',
    title: 'React Server Components',
    desc: '服务端渲染组件，减少客户端JS体积，直接访问后端资源',
    tech: 'RSC',
  },
  {
    icon: '🎯',
    title: 'Server Actions',
    desc: '客户端直接调用服务端函数，无需手动创建API路由',
    tech: 'Server Actions',
  },
  {
    icon: '🗺️',
    title: 'App Router',
    desc: '基于文件系统的路由系统，支持嵌套布局和加载态',
    tech: 'App Router',
  },
  {
    icon: '📡',
    title: 'Streaming SSR',
    desc: '流式渲染，页面内容可分块渐进式加载呈现',
    tech: 'Streaming',
  },
  {
    icon: '🔗',
    title: 'RESTful API',
    desc: '内置API Routes，轻松构建完整的后端服务',
    tech: 'API Routes',
  },
];

export function FrameworkHighlights() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">⚡ 框架特性</h2>
      <div className="space-y-3">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="group rounded-lg border border-border/40 p-3 hover:bg-accent/30 transition-all hover:border-primary/30"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                    {item.tech}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
