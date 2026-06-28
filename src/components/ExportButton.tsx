'use client';

import { useState, useRef, useEffect } from 'react';

interface ExportButtonProps {
  content: string;      // Markdown 内容
  title?: string;       // 文件标题
  className?: string;
}

const EXPORT_FORMATS = [
  { key: 'md', label: 'Markdown', icon: '📝', desc: '.md 文件' },
  { key: 'html', label: 'HTML', icon: '🌐', desc: '网页格式' },
  { key: 'txt', label: '纯文本', icon: '📄', desc: '.txt 文件' },
  { key: 'docx', label: 'Word', icon: '📘', desc: '即将支持' },
  { key: 'pdf', label: 'PDF', icon: '📕', desc: '即将支持' },
];

export default function ExportButton({ content, title = '报告', className }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleExport = async (format: string) => {
    if (format === 'docx' || format === 'pdf') return; // 未支持
    setLoading(format);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format, title }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '导出失败');
        return;
      }

      // 下载文件
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.${format === 'html' ? 'html' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err: any) {
      alert('导出失败: ' + err.message);
    } finally {
      setLoading(null);
    }
  };

  if (!content) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
          bg-[#1e1e2a] text-[#94a3b8] hover:bg-[#7c3aed] hover:text-white border border-[#2a2a3a]
          ${className || ''}`}
        title="导出报告"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        导出
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#16161e] border border-[#2a2a3a] rounded-lg shadow-xl py-1 min-w-[160px]">
          {EXPORT_FORMATS.map(f => {
            const disabled = f.key === 'docx' || f.key === 'pdf';
            return (
              <button
                key={f.key}
                onClick={() => !disabled && handleExport(f.key)}
                disabled={disabled || loading === f.key}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                  ${disabled ? 'text-[#4a4a5a] cursor-not-allowed' : 'text-[#e2e8f0] hover:bg-[#7c3aed]'}
                  ${loading === f.key ? 'opacity-50' : ''}`}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
                {disabled && <span className="text-xs text-[#4a4a5a] ml-auto">即将支持</span>}
                {loading === f.key && (
                  <svg className="animate-spin h-3 w-3 ml-auto" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
