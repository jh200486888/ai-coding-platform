"use client";

import { useState, useCallback, useRef } from 'react';
import { User, Bot, Image, FileText, Code, Copy, Check, Pencil, Volume2, Square, FileSearch, Brain, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import HtmlPreviewCard from './html-preview-card';
import type { Message, Attachment } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

// Clean attachment markers from message content for display
function cleanAttachmentMarkers(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[image:[\s\S]*?\]/g, '[图片]')
    .replace(/\[file:[^\]]*?\]:\n[\s\S]*?(?=\n\[|$)/g, '[文件]')
    .replace(/\[file:data:[^\]]+\]/g, '[文件]')
    .trim();
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
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
  if (!text) return '';
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
  type: 'code' | 'text' | 'report-card' | 'html-preview';
  content: string;
  lang?: string;
  reportTitle?: string;
  reportSummary?: string;
  reportArtifactId?: string;
  htmlData?: { html: string; title: string; viewport: string };
}

function parseContent(text: string): ContentSegment[] {
  // Null safety: ensure text is always a string
  if (!text || typeof text !== 'string') text = '';
  const segments: ContentSegment[] = [];
  
  // Extract FULL_REPORT content and REPORT_CARD title
  let reportTitle: string | undefined;
  let fullReportContent = '';
  
  // P71: Match REPORT_CARD with optional artifactId
  // Format: <!--REPORT_CARD\ntitle\nartifactId\n--> or <!--REPORT_CARD\ntitle\n-->
  let reportArtifactId: string | undefined;
  const reportBlockMatch = text.match(/<!--REPORT_CARD\n(.+?)\n(.+?)?\n-->/);
  if (reportBlockMatch) {
    reportTitle = reportBlockMatch[1];
    reportArtifactId = reportBlockMatch[2] || undefined;
    text = text.replace(/<!--REPORT_CARD[\s\S]*?-->/, '');
  }
  
  // Remove EXEC_LOG from display
  text = text.replace(/\n?<!--EXEC_LOG[\s\S]*?-->/g, '');
  // Remove REPORT_CARD wrapper tags but keep content
  text = text.replace(/<!--REPORT_CARD[\s\S]*?-->/g, '');
  text = text.replace(/<!--FULL_REPORT[\s\S]*?-->/g, '');

  // Extract HTML_PREVIEW marker if present
  let htmlPreviewData: { html: string; title: string; viewport: string } | undefined;
  const htmlPreviewMatch = text.match(/<!--HTML_PREVIEW\n([\s\S]*?)\n-->/);
  if (htmlPreviewMatch) {
    const meta = htmlPreviewMatch[1];
    const titleM = meta.match(/title:(.*)/);
    const viewportM = meta.match(/viewport:(.*)/);
    const htmlM = meta.match(/html:(.*)/);
    if (htmlM) {
      try {
        htmlPreviewData = {
          title: titleM ? titleM[1].trim() : 'Preview',
          viewport: viewportM ? viewportM[1].trim() : 'desktop',
          html: (() => { try { return decodeURIComponent(escape(atob(htmlM[1].trim()))); } catch { return atob(htmlM[1].trim()); } })(),
        };
      } catch {}
    }
    text = text.replace(/<!--HTML_PREVIEW\n[\s\S]*?\n-->/, '');
  }
  
  // Remove DSML tool-call markup
  const hadDSML = text.includes('DSML') || text.includes('tool_calls') || text.includes('invoke name=');
  text = text.replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?(?=<｜｜DSML｜｜|$)/g, '');
  text = text.replace(/<｜｜DSML｜｜[^>]*>/g, '');
  text = text.replace(/invoke name="[^"]*">/g, '');
  text = text.replace(/parameter name="[^"]*"[^>]*>[^<]*/g, '');
  text = text.replace(/<[^>]*DSML[^>]*>/g, '');
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
  
  // Add report card segment if marker was found
  if (reportTitle) {
    const summaryText = segments
      .filter(s => s.type === 'text')
      .map(s => s.content)
      .join(' ')
      .trim()
      .slice(0, 100);
    segments.push({ type: 'report-card', content: '', reportTitle, reportSummary: summaryText, reportArtifactId });
  }
  
  // Add html-preview segment if HTML_PREVIEW marker was found
  if (htmlPreviewData) {
    segments.push({ type: 'html-preview', content: '', htmlData: htmlPreviewData });
  }
  
  // Auto-detect HTML code blocks and add preview after them
  const htmlCodeSegments: number[] = [];
  segments.forEach((seg, idx) => {
    if (seg.type === 'code' && (seg.lang === 'html' || seg.lang === 'htm') && seg.content.trim().startsWith('<')) {
      htmlCodeSegments.push(idx);
    }
  });
  for (let i = htmlCodeSegments.length - 1; i >= 0; i--) {
    const idx = htmlCodeSegments[i];
    const codeSeg = segments[idx];
    segments.splice(idx + 1, 0, {
      type: 'html-preview',
      content: '',
      htmlData: { html: codeSeg.content, title: 'HTML 预览', viewport: 'desktop' },
    });
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
    <div className="my-2 rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117] max-w-full">
      <div className="flex items-center justify-between px-2 md:px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
        <span className="text-xs text-[#8b949e] font-mono">{lang || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors px-2 py-0.5 rounded hover:bg-[#161b22]/80 min-h-[32px]">
          {copied ? (<><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">已复制</span></>) : (<><Copy className="w-3 h-3" /><span>复制</span></>)}
        </button>
      </div>
      <pre className="p-2 md:p-3 !m-0 overflow-x-auto text-xs md:text-sm !bg-[#0d1117] -webkit-overflow-scrolling-touch">
        <code className={`language-${lang || 'text'} hljs font-mono whitespace-pre`} dangerouslySetInnerHTML={{ __html: content }} />
      </pre>
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

function ReportCard({ title, conversationId, artifactId }: { title: string; conversationId?: string; artifactId?: string }) {

  const handleClick = () => {
    if (artifactId) {
      // P71: Open dedicated report page showing only this report (no other chat history)
      window.open('/report/' + artifactId, '_blank');
      return;
    }
    // Fallback: open conversation preview
    let convId = conversationId;
    if (!convId) {
      const urlParams = new URLSearchParams(window.location.search);
      convId = urlParams.get('conv') || urlParams.get('id') || undefined;
    }
    if (convId) {
      window.open('/preview/' + convId, '_blank');
    }
  };
  return (
    <div
      onClick={handleClick}
      className="mt-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 px-3 md:px-4 py-3 md:py-3.5 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-2 md:gap-3">
        <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
          <FileSearch className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            点击查看完整详细文档
          </div>
        </div>
        <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
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
        if (seg.type === 'report-card') return <ReportCard key={i} title={seg.reportTitle || '分析报告'} conversationId={conversationId} artifactId={seg.reportArtifactId} />;
        if (seg.type === 'html-preview' && seg.htmlData) return <HtmlPreviewCard key={i} html={seg.htmlData.html} title={seg.htmlData.title} viewport={seg.htmlData.viewport as any} />;
        if (isAssistant && seg.content && seg.content.length > 20) {
          return (
            <div key={i} className="prose prose-invert max-w-none
              prose-headings:text-foreground prose-h1:text-xl prose-h1:mb-2 prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-4 prose-h2:text-primary prose-h3:text-base prose-h3:mt-3 prose-h3:text-primary
              prose-p:text-foreground prose-p:leading-7 prose-p:my-2 prose-p:text-[15px]
              prose-strong:text-primary prose-strong:font-semibold
              prose-code:text-accent prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-li:text-foreground prose-li:my-1 prose-li:text-[15px]
              prose-a:text-primary prose-a:underline hover:prose-a:text-accent prose-blockquote:border-primary prose-blockquote:text-muted-foreground
              prose-table:text-sm prose-th:px-2 md:prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:border-b prose-th:border-border prose-th:bg-primary/10
              prose-td:px-2 md:prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-border">
              <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                table: (props) => <div className="my-3 overflow-x-auto -mx-2 px-2 snap-x"><table className="w-full border-collapse border border-border rounded-lg text-sm" {...props}/></div>,
                thead: (props) => <thead className="bg-primary/10" {...props}/>,
                tbody: (props) => <tbody className="divide-y divide-border" {...props}/>,
                tr: (props) => <tr className="hover:bg-muted/30 even:bg-muted/10" {...props}/>,
                th: (props) => <th className="px-2 md:px-3 py-2.5 text-left text-xs font-semibold text-foreground border-b border-border whitespace-nowrap" {...props}/>,
                td: (props) => <td className="px-2 md:px-3 py-2 text-sm text-foreground border-b border-border" {...props}/>,
              }}
            >{seg.content}</ReactMarkdown>
            </div>
          );
        }
        return <span key={i} className="whitespace-pre-wrap break-words">{stripMarkdown(seg.content)}</span>;
      })}
    </>
  );
}


// ============ Thinking Process Display ============
function ThinkingBlock({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!content || content.trim().length === 0) return null;
  
  return (
    <div className="mb-3 rounded-lg border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-violet-400 hover:bg-violet-500/10 transition-colors min-h-[44px]"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">思考过程</span>
        {isExpanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
        {!isExpanded && <span className="text-muted-foreground truncate ml-1 max-w-[200px]">{content.slice(0, 50)}...</span>}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-violet-500/10">
          <div className="text-xs text-muted-foreground/80 whitespace-pre-wrap break-words leading-relaxed max-h-[400px] overflow-y-auto">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, isStreaming, isEditing, editContent, onEdit, onEditChange, onEditSave, onEditCancel, conversationId }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
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

  // Copy full AI message
  const [isMsgCopied, setIsMsgCopied] = useState(false);
  const handleCopyMessage = useCallback(async () => {
    try {
      const text = stripMarkdown(message.content || '');
      await navigator.clipboard.writeText(text);
      setIsMsgCopied(true);
      setTimeout(() => setIsMsgCopied(false), 2000);
    } catch {}
  }, [message.content]);

  return (
    <div className={`flex gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary' : 'bg-muted'}`}>
        {isUser ? <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-foreground" /> : <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />}
      </div>
      <div className={`flex-1 ${isUser ? 'max-w-[90%] md:max-w-[80%]' : 'max-w-full md:max-w-[95%]'} rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-[14px] md:text-[15px] ${isUser ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20' : 'bg-card border border-border border-l-2 border-l-primary/30 overflow-hidden'}`}>
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
            {/* Thinking process display */}
            {!isUser && (message as any).reasoning && (message as any).reasoning?.length > 0 && (
              <ThinkingBlock content={(message as any).reasoning.map((r: any) => r.text || '').join('\n')} />
            )}
            {(message.content || message.attachments?.length > 0) && (
              <div className="text-sm break-words">
                {isUser ? (
                  <span className="whitespace-pre-wrap break-words">{cleanAttachmentMarkers(message.content || '')}</span>
                ) : (
                  <>
                    <RenderedContent content={message.content} conversationId={conversationId} isAssistant={true} />
                    {isStreaming && <span className="typing-cursor" />}
                  </>
                )}
              </div>
            )}
            {isUser && message.content && !isEditing && (
              <button
                onClick={onEdit}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-primary-foreground/50 hover:text-primary-foreground/90 transition-colors min-h-[32px]"
              >
                <Pencil className="w-2.5 h-2.5" />
                编辑
              </button>
            )}
            {!isUser && message.content && (
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors min-h-[32px]"
                >
                  {isMsgCopied ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
                  {isMsgCopied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={handleTTS}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors min-h-[32px]"
                >
                  {isPlaying ? <Square className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                  {isPlaying ? '停止' : '朗读'}
                </button>
              </div>
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
