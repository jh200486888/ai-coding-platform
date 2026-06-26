'use client';

import { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeString]);

  // Inline code (no language class, usually short)
  if (!className && !codeString.includes('\n')) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <span className="text-xs text-[#8b949e] font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <pre className="!m-0 !rounded-none overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: CodeBlock as never,
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
