"use client";

import { useState, useCallback, useRef } from 'react';
import { User, Bot, Image, FileText, Code, Copy, Check, Pencil, Volume2, Square, FileSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Message, Attachment } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Clean attachment markers from message content for display
function cleanAttachmentMarkers(text: string): string {
  return text
    .replace(/\[image:[\s\S]*?\]/g, '[图片]')
    .replace(/\[file:[^\]]*?\]:\n[\s\S]*?(?=\n\[|$)/g, '[文件]')
    .replace(/\[file:data:[^\]]+\]/g, '[文件]')
    .trim();
}

interface MessageBubbleProps {
  message: Message;
  isEditing?: boolean;
  editContent?: string;
  onEdit?: () => void;
  onEditChange?: (v: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  conversationId?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentTypeIcon({ type }: { type: Attachment['type'] }) {
  switch (type) {
    case 'image':
      return <Image className="w-3.5 h-3.5 text-blue-400" />;
    case 'code':
      return <Code className="w-3.5 h-3.5 text-green-400" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-orange-400" />;
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^---+$/gm, '──────────');
}

interface ContentSegment {
  type: 'code' | 'text' | 'report-card';
  content: string;
  lang?: string;
  reportTitle?: string;
}

function parseContent(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  
  // Extract REPORT_CARD marker if present
  let reportTitle: string | undefined;
  const reportMatch = text.match(/<!--REPORT_CARD\n(.+?)\n-->/);
  if (reportMatch) {
    reportTitle = reportMatch[1];
    text = text.replace(/<!--REPORT_CARD\n.+?\n-->/, '');
  }
  
  // Remove EXEC_LOG from display
  text = text.replace(/\n\n<!--EXEC_LOG\n[\s\S]*?\n-->/, '');
  
  // Remove DSML tool-call markup that model outputs as text when prepareStep disables tools
  const hadDSML = text.includes('DSML') || text.includes('tool_calls') || text.includes('invoke name=');
  text = text.replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?(?=<｜｜DSML｜｜|$)/g, '');
  text = text.replace(/<｜｜DSML｜｜[^>]*>/g, '');
  // Clean up any remaining DSML-related artifacts
  text = text.replace(/invoke name="[^"]*">/g, '');
  text = text.replace(/parameter name="[^"]*"[^>]*>[^<]*/g, '');
  text = text.replace(/<[^>]*DSML[^>]*>/g, '');
  // If the entire text was just DSML markup, show a placeholder
  if (text.trim().length === 0 && hadDSML) {
    text = '正在生成分析报告，请稍候...';
  }
  
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) segments.push({ type: 'text', content: textBefore });
    }
    segments.push({ type: 'code', lang: match[1] || '', content: match[2].replace(/\n$/, '') });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) segments.push({ type: 'text', content: remaining });
  }
  
  // Add report card segment at the end if marker was found
  if (reportTitle) {
    segments.push({ type: 'report-card', content: '', reportTitle });
  }
  
  if (segments.length === 0 && text) segments.push({ type: 'text', content: text });
  return segments;
}

function CodeBlock({ content, lang }: { content: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [content]);
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border bg-[#1a1a2e]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#16162a] border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{lang || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-muted/50">
          {copied ? (<><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">已复制</span></>) : (<><Copy className="w-3 h-3" /><span>复制</span></>)}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-sm"><code className="text-green-300 font-mono whitespace-pre">{content}</code></pre>
    </div>
  );
}

function AttachmentItem({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image') {
    return (
      <div className="group relative">
        <img src={attachment.url} alt={attachment.name} className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-border/50" />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">{attachment.name}</div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 max-w-[200px]">
      <AttachmentTypeIcon type={attachment.type} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{attachment.name}</div>
        <div className="text-[10px] text-muted-foreground">{formatSize(attachment.size)}</div>
      </div>
    </div>
  );
}

function ReportCard({ title, conversationId }: { title: string; conversationId?: string }) {
  const router = useRouter();
  const handleClick = () => {
    if (conversationId) {
      router.push(`/preview/${conversationId}`);
    }
  };
  return (
    <div
      onClick={handleClick}
      className="mt-3 flex items-center gap-3 bg-muted/60 hover:bg-muted border border-border/60 hover:border-primary/40 rounded-lg px-4 py-3 cursor-pointer transition-all group"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <FileSearch className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">点击查看完整分析文档</div>
      </div>
      <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function RenderedContent({ content, conversationId, isAssistant }: { content: string; conversationId?: string; isAssistant?: boolean }) {
  const segments = parseContent(content);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'code') return <CodeBlock key={i} content={seg.content} lang={seg.lang} />;
        if (seg.type === 'report-card') return <ReportCard key={i} title={seg.reportTitle || '分析报告'} conversationId={conversationId} />;
        if (isAssistant && seg.content.length > 100) {
          // Render longer assistant text as Markdown for proper formatting
          return (
            <div key={i} className="prose prose-invert prose-sm max-w-none
              prose-headings:text-[#e2e8f0] prose-h1:text-lg prose-h2:text-base prose-h2:text-[#a78bfa] prose-h3:text-sm prose-h3:text-[#8b5cf6]
              prose-p:text-[#cbd5e1] prose-p:leading-relaxed prose-p:my-1
              prose-strong:text-[#a78bfa]
              prose-code:text-[#06b6d4] prose-code:bg-[#1e1e2a] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-li:text-[#cbd5e1] prose-li:my-0.5
              prose-table:text-sm prose-table:border prose-table:border-[#2a2a3a]
              prose-th:bg-[#7c3aed] prose-th:text-white prose-th:px-2 prose-th:py-1
              prose-td:text-[#cbd5e1] prose-td:border-[#2a2a3a] prose-td:px-2 prose-td:py-1
              prose-blockquote:border-[#7c3aed] prose-blockquote:text-[#94a3b8]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.content}</ReactMarkdown>
            </div>
          );
        }
        return <span key={i} className="whitespace-pre-wrap break-words">{stripMarkdown(seg.content)}</span>;
      })}
    </>
  );
}

export function MessageBubble({ message, isEditing, editContent, onEdit, onEditChange, onEditSave, onEditCancel, conversationId }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTTS = useCallback(async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }
    try {
      setIsPlaying(true);
      const text = message.content || '';
      if (!text) { setIsPlaying(false); return; }
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
      });
      if (!res.ok) { setIsPlaying(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsPlaying(false); audioRef.current = null; URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsPlaying(false); audioRef.current = null; URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, message.content]);

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary' : 'bg-muted'}`}>
        {isUser ? <User className="w-4 h-4 text-primary-foreground" /> : <Bot className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className={`flex-1 max-w-[80%] rounded-lg px-4 py-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
        {hasAttachments && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.attachments!.map(att => <AttachmentItem key={att.id} attachment={att} />)}
          </div>
        )}

        {isEditing && isUser ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={e => onEditChange?.(e.target.value)}
              className="w-full bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={onEditCancel} className="px-3 py-1 text-xs rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">取消</button>
              <button onClick={onEditSave} className="px-3 py-1 text-xs rounded-lg bg-primary-foreground text-primary font-medium hover:bg-primary-foreground/90 transition-colors">发送</button>
            </div>
          </div>
        ) : (
          <>
            {message.content && (
              <div className="text-sm break-words">
                {isUser ? (
                  <span className="whitespace-pre-wrap break-words">{cleanAttachmentMarkers(message.content)}</span>
                ) : (
                  <RenderedContent content={message.content} conversationId={conversationId} isAssistant={true} />
                )}
              </div>
            )}
            {isUser && message.content && !isEditing && (
              <button
                onClick={onEdit}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-primary-foreground/50 hover:text-primary-foreground/90 transition-colors"
              >
                <Pencil className="w-2.5 h-2.5" />
                编辑
              </button>
            )}
            {!isUser && message.content && (
              <button
                onClick={handleTTS}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {isPlaying ? <Square className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                {isPlaying ? '停止' : '朗读'}
              </button>
            )}
          </>
        )}

        <div className={`text-xs mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
