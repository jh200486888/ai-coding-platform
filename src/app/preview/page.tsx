'use client';

import { useState } from 'react';

export default function PreviewPage() {
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      {/* 页头 */}
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            🎨 组件预览
          </h1>
          <p className="text-muted-foreground mt-2">
            紫色深色主题 · 组件库视觉展示
          </p>
        </div>

        {/* 网格布局 */}
        <div className="grid gap-8 md:grid-cols-2">

          {/* 卡片区块 */}
          <div className="col-span-full">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              卡片
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: '对话卡片', desc: 'AI 对话交互', icon: '💬', color: 'border-l-primary' },
                { title: '代码卡片', desc: '代码生成与编辑', icon: '⚡', color: 'border-l-accent' },
                { title: '图片卡片', desc: 'AI 图片生成', icon: '🎨', color: 'border-l-rose-500' },
              ].map((card) => (
                <div
                  key={card.title}
                  className={`bg-card border border-border rounded-lg p-5 border-l-4 ${card.color} hover:border-l-8 transition-all duration-200 cursor-pointer group`}
                >
                  <span className="text-2xl">{card.icon}</span>
                  <h3 className="text-foreground font-semibold mt-3 group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 按钮 */}
          <div className="col-span-full">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              按钮
            </h2>
            <div className="flex flex-wrap gap-3">
              <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all font-medium text-sm shadow-lg shadow-primary/20">
                主要按钮
              </button>
              <button className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-muted transition-all font-medium text-sm border border-border">
                次要按钮
              </button>
              <button className="px-5 py-2.5 text-foreground rounded-lg hover:bg-card transition-all font-medium text-sm border border-border">
                幽灵按钮
              </button>
              <button className="px-5 py-2.5 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-all font-medium text-sm shadow-lg shadow-accent/20">
                强调按钮
              </button>
              <button disabled className="px-5 py-2.5 bg-muted text-muted-foreground rounded-lg font-medium text-sm cursor-not-allowed">
                禁用状态
              </button>
              <button className="px-5 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm shadow-lg shadow-purple-500/20">
                渐变按钮
              </button>
            </div>
          </div>

          {/* 表单元素 */}
          <div className="col-span-full">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              表单
            </h2>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">输入框</label>
                <input
                  type="text"
                  placeholder="请输入内容..."
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">搜索框</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
                  <input
                    type="text"
                    placeholder="搜索..."
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="check" className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/50" />
                <label htmlFor="check" className="text-sm text-foreground">同意条款</label>
              </div>
            </div>
          </div>

          {/* 徽标 & 标签 */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              标签
            </h2>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-primary/15 text-primary text-xs font-medium rounded-full border border-primary/20">AI</span>
              <span className="px-3 py-1 bg-accent/15 text-accent text-xs font-medium rounded-full border border-accent/20">New</span>
              <span className="px-3 py-1 bg-rose-500/15 text-rose-400 text-xs font-medium rounded-full border border-rose-500/20">热门</span>
              <span className="px-3 py-1 bg-emerald-500/15 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">Pro</span>
              <span className="px-3 py-1 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">Beta</span>
              <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">默认</span>
            </div>
          </div>

          {/* 消息/提示 */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              提示
            </h2>
            <div className="space-y-2">
              <div className="px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
                <span>ℹ️</span> 这是一条信息提示
              </div>
              <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400 flex items-center gap-2">
                <span>✅</span> 操作成功完成
              </div>
              <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400 flex items-center gap-2">
                <span>⚠️</span> 出错了，请重试
              </div>
            </div>
          </div>

          {/* 计数器交互 */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              交互组件
            </h2>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-4xl font-bold text-primary mb-4">{count}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setCount((c) => c - 1)}
                  className="w-10 h-10 rounded-lg bg-secondary border border-border text-foreground hover:bg-muted transition-all font-bold text-lg"
                >
                  −
                </button>
                <button
                  onClick={() => setCount((c) => c + 1)}
                  className="w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all font-bold text-lg shadow-lg shadow-primary/20"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 复制组件 */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              代码块
            </h2>
            <div className="bg-[#0d1117] border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border">
                <span className="text-xs text-muted-foreground">example.ts</span>
                <button
                  onClick={handleCopy}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? '已复制 ✓' : '复制'}
                </button>
              </div>
              <pre className="!bg-transparent !p-4 text-sm">
                <code>
                  <span className="text-blue-400">const</span>{" "}
                  <span className="text-purple-400">greeting</span>{" "}
                  <span className="text-gray-400">=</span>{" "}
                  <span className="text-emerald-400">"Hello, AI!"</span>
                  {"\n"}
                  <span className="text-blue-400">function</span>{" "}
                  <span className="text-yellow-400">welcome</span>
                  <span className="text-gray-400">()</span> {"{"}
                  {"\n"}
                  {"  "}<span className="text-blue-400">return</span>{" "}
                  <span className="text-purple-400">greeting</span>
                  {"\n"}{"}"}
                  {"\n\n"}
                  <span className="text-gray-500">// 紫色深色主题</span>
                  {"\n"}
                  <span className="text-blue-400">console</span>.
                  <span className="text-yellow-400">log</span>
                  <span className="text-gray-400">(</span>
                  <span className="text-emerald-400">"🎨 好看吗？"</span>
                  <span className="text-gray-400">)</span>
                </code>
              </pre>
            </div>
          </div>

          {/* 加载动画 */}
          <div className="col-span-full">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block"></span>
              加载状态
            </h2>
            <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <span className="text-sm text-muted-foreground">加载中...</span>
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  ></div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-ping"></div>
                <span className="text-sm text-muted-foreground">处理中</span>
              </div>
              <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>

          {/* 分割线 */}
          <div className="col-span-full">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-4 text-xs text-muted-foreground">更多组件开发中...</span>
              </div>
            </div>
          </div>

          {/* 底部信息 */}
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground text-sm">
              {typeof window !== 'undefined' ? window.location.host : 'AI Coding Platform'} · 基于 Next.js + Tailwind CSS
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
