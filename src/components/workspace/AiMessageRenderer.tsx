'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, Play, FileCode, Terminal, ChevronDown, ChevronRight } from 'lucide-react';

interface AiMessageRendererProps {
  content: string;
  onApplyFile?: (path: string, content: string) => void;
  onRunCommand?: (command: string) => void;
}

/** Parse code block language to detect file path or command type */
function parseCodeMeta(className: string | undefined): {
  language: string;
  filePath?: string;
  isCommand: boolean;
} {
  if (!className) return { language: '', isCommand: false };

  // Remove "language-" prefix
  const raw = className.replace(/^language-/, '');

  // Detect file:path/to/file pattern
  const fileMatch = raw.match(/^file:(.+)$/);
  if (fileMatch) {
    return { language: '', filePath: fileMatch[1], isCommand: false };
  }

  // Detect command type
  if (raw === 'command' || raw === 'bash' || raw === 'sh' || raw === 'shell') {
    return { language: raw, isCommand: true };
  }

  return { language: raw, isCommand: false };
}

/** Detect language from file extension */
function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
    java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    sql: 'sql', md: 'markdown', sh: 'bash',
    php: 'php', swift: 'swift', kt: 'kotlin',
  };
  return map[ext] || '';
}

/** Single code block with actions */
function CodeBlock({
  code,
  language,
  filePath,
  isCommand,
  onApplyFile,
  onRunCommand,
}: {
  code: string;
  language: string;
  filePath?: string;
  isCommand: boolean;
  onApplyFile?: (path: string, content: string) => void;
  onRunCommand?: (command: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const lineCount = code.split('\n').length;
  const isLong = lineCount > 15;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleApply = useCallback(() => {
    if (filePath && onApplyFile) {
      onApplyFile(filePath, code);
      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    }
  }, [filePath, code, onApplyFile]);

  const handleRun = useCallback(() => {
    if (isCommand && onRunCommand) {
      onRunCommand(code.trim());
    }
  }, [isCommand, code, onRunCommand]);

  const displayLang = filePath ? languageFromPath(filePath) : language;
  const displayLabel = filePath || language || 'code';

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden bg-[#1a1b26]">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16161e] border-b border-border text-xs">
        {filePath ? (
          <FileCode className="w-3.5 h-3.5 text-accent" />
        ) : isCommand ? (
          <Terminal className="w-3.5 h-3.5 text-green-400" />
        ) : null}
        <span className="text-muted-foreground font-mono">{displayLabel}</span>

        {isLong && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground ml-1"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span className="ml-0.5">{collapsed ? '展开' : '折叠'}</span>
          </button>
        )}

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {filePath && onApplyFile && (
            <button
              onClick={handleApply}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                applied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-accent/20 text-accent hover:bg-accent/30'
              }`}
            >
              {applied ? '✓ 已应用' : '应用更改'}
            </button>
          )}
          {isCommand && onRunCommand && (
            <button
              onClick={handleRun}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              <Play className="w-3 h-3" />
              运行
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Code content */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <pre className={`p-3 text-sm leading-relaxed ${isLong ? 'max-h-[400px] overflow-y-auto' : ''}`}>
            <code className={`language-${displayLang || 'plaintext'}`}>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export function AiMessageRenderer({ content, onApplyFile, onRunCommand }: AiMessageRendererProps) {
  return (
    <div className="ai-message-content text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children, ...props }) {
            const codeString = String(children).replace(/\n$/, '');
            const { language, filePath, isCommand } = parseCodeMeta(className);

            // Inline code (no className usually, or single line without newlines)
            const isInline = !className && !codeString.includes('\n');
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono text-accent" {...props}>
                  {children}
                </code>
              );
            }

            // Block code with file path or command
            if (filePath || isCommand) {
              return (
                <CodeBlock
                  code={codeString}
                  language={language}
                  filePath={filePath}
                  isCommand={isCommand}
                  onApplyFile={onApplyFile}
                  onRunCommand={onRunCommand}
                />
              );
            }

            // Regular block code
            return (
              <CodeBlock
                code={codeString}
                language={language}
                filePath={undefined}
                isCommand={false}
                onApplyFile={onApplyFile}
                onRunCommand={onRunCommand}
              />
            );
          },
          // Paragraphs
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          // Headings
          h1({ children }) {
            return <h1 className="text-lg font-bold mb-2 mt-3">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>;
          },
          // Lists
          ul({ children }) {
            return <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm">{children}</li>;
          },
          // Blockquote
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-accent pl-3 my-2 text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          // Links
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {children}
              </a>
            );
          },
          // Table
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="text-xs border-collapse border border-border">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-border px-2 py-1 bg-muted text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-border px-2 py-1">{children}</td>;
          },
          // Horizontal rule
          hr() {
            return <hr className="border-border my-3" />;
          },
          // Strong & em
          strong({ children }) {
            return <strong className="font-semibold text-foreground">{children}</strong>;
          },
        }}
      />
    </div>
  );
}
