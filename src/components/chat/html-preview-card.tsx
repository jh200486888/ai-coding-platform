'use client';

import { useState, useRef } from 'react';
import { Monitor, Tablet, Smartphone, RefreshCw, Maximize2, Minimize2, ExternalLink, Code2, Copy, Check } from 'lucide-react';

interface HtmlPreviewCardProps {
  html: string;
  title: string;
  viewport?: 'desktop' | 'tablet' | 'mobile';
}

const viewportWidths: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const viewportLabels: Record<string, { icon: typeof Monitor; label: string }> = {
  desktop: { icon: Monitor, label: '桌面' },
  tablet: { icon: Tablet, label: '平板' },
  mobile: { icon: Smartphone, label: '手机' },
};

export default function HtmlPreviewCard({ html, title, viewport: initialViewport = 'desktop' }: HtmlPreviewCardProps) {
  const [viewport, setViewport] = useState(initialViewport);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefresh = () => setRefreshKey(k => k + 1);
  const toggleFullscreen = () => { setIsFullscreen(!isFullscreen); setShowCode(false); };

  const openInNewTab = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col'
    : 'my-2 rounded-lg border border-[#2a2a3a] overflow-hidden bg-[#1a1a2e]';

  return (
    <div className={containerClass}>
      {/* Browser-style toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#16162a] border-b border-[#2a2a3a]">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-xs font-medium text-gray-400 truncate max-w-[180px]">{title}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Viewport switcher */}
          {Object.entries(viewportLabels).map(([key, { icon: Icon, label }]) => (
            <button
              key={key}
              onClick={() => setViewport(key as any)}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewport === key ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a2a3a]'
              }`}
              title={label}
            >
              <Icon size={14} />
            </button>
          ))}

          <div className="w-px h-4 bg-[#2a2a3a] mx-1" />

          {/* Code view toggle */}
          <button
            onClick={() => setShowCode(!showCode)}
            className={`p-1.5 rounded text-xs transition-colors ${
              showCode ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a2a3a]'
            }`}
            title={showCode ? '预览' : '查看代码'}
          >
            <Code2 size={14} />
          </button>

          {/* Copy code */}
          {showCode && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition-colors"
              title="复制代码"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          )}

          <div className="w-px h-4 bg-[#2a2a3a] mx-1" />

          <button onClick={handleRefresh} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition-colors" title="刷新">
            <RefreshCw size={14} />
          </button>
          <button onClick={openInNewTab} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition-colors" title="新窗口打开">
            <ExternalLink size={14} />
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition-colors" title={isFullscreen ? '退出全屏' : '全屏'}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className={`flex-1 ${isFullscreen ? '' : 'min-h-[450px]'} bg-white flex justify-center overflow-auto`}>
        {showCode ? (
          /* Code view */
          <div className="w-full bg-[#0d1117] p-4 overflow-auto" style={{ minHeight: isFullscreen ? '100%' : '450px' }}>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
              <code>{html}</code>
            </pre>
          </div>
        ) : (
          /* Preview area */
          <div
            style={{
              width: viewportWidths[viewport],
              maxWidth: '100%',
              height: '100%',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <iframe
              key={refreshKey}
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block', minHeight: isFullscreen ? '100%' : '450px' }}
              title={title}
            />
          </div>
        )}
      </div>
    </div>
  );
}
