'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Eye, RefreshCw, Maximize2, Minimize2, Code2 } from 'lucide-react';

interface PreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  isStreaming?: boolean;
}

/**
 * 右侧实时预览面板
 * 用 iframe + srcdoc 渲染 HTML/CSS/JS 代码
 */
export function PreviewPanel({ isOpen, onClose, code, isStreaming }: PreviewPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedCode, setDebouncedCode] = useState(code);

  // 流式输出时防抖 300ms 更新预览，避免频繁刷新
  useEffect(() => {
    if (isStreaming) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedCode(code);
      }, 300);
    } else {
      setDebouncedCode(code);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [code, isStreaming]);

  // 当面板打开且代码变化时自动刷新
  useEffect(() => {
    if (isOpen && debouncedCode) {
      setRefreshKey(k => k + 1);
    }
  }, [isOpen, debouncedCode]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    // 强制刷新 iframe
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = debouncedCode;
        }
      }, 50);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`border-l border-border bg-card flex flex-col transition-all duration-200 overflow-hidden ${
        isFullscreen
          ? 'fixed inset-0 z-50'
          : 'w-[45%] min-w-[400px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Eye className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium flex-1">实时预览</span>
        {isStreaming && (
          <span className="flex gap-1 mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
          title="刷新预览"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
          title="关闭预览"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview area */}
      {debouncedCode ? (
        <div className="flex-1 bg-white min-h-0">
          <iframe
            ref={iframeRef}
            key={refreshKey}
            srcDoc={debouncedCode}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
            title="实时预览"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center px-6">
            <Code2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">点击消息中代码块的「预览」按钮</p>
            <p className="text-xs mt-1 opacity-60">HTML/CSS/JS 代码将在此实时渲染</p>
          </div>
        </div>
      )}
    </div>
  );
}
