'use client';

import { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, FileCode } from 'lucide-react';

import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');
  const lines = codeString.split('\n');
  const showLineNumbers = lines.length > 5;

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
    <div className="relative group my-3 rounded-lg overflow-hidden bg-[#0d1117] border border-[#30363d]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <FileCode size={12} className="text-[#8b949e]" />
          <span className="text-xs text-[#8b949e] font-mono uppercase">{language || 'code'}</span>
          <span className="text-xs text-[#484f58]">{lines.length} lines</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors px-2 py-0.5 rounded hover:bg-[#21262d]"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-400" />
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {showLineNumbers ? (
              lines.map((line, i) => (
                <tr key={i} className="hover:bg-[#161b22]/50">
                  <td className="text-right px-3 py-0 text-[#484f58] text-xs select-none w-12 border-r border-[#21262d] align-top font-mono">
                    {i + 1}
                  </td>
                  <td className="px-4 py-0">
                    <pre className="!m-0 !bg-transparent !rounded-none"><code className={className} {...props}>{line || ' '}</code></pre>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-0">
                  <pre className="!m-0 !bg-transparent !rounded-none overflow-x-auto"><code className={className} {...props}>{children}</code></pre>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
