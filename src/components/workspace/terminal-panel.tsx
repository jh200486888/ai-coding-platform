'use client';

import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'warning' | 'success';
  content: string;
  timestamp: Date;
}

interface TerminalPanelProps {
  lines: TerminalLine[];
  onCommand: (command: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function getLineColor(type: TerminalLine['type']): string {
  switch (type) {
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    case 'success':
      return 'text-green-400';
    case 'input':
      return 'text-blue-400';
    default:
      return 'text-gray-300';
  }
}

export function TerminalPanel({
  lines,
  onCommand,
  isCollapsed,
  onToggleCollapse,
}: TerminalPanelProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    onCommand(input);
    setHistory([input, ...history].slice(0, 100));
    setHistoryIndex(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className={cn(
      'flex flex-col bg-[#0d1117] border-t border-gray-800 transition-all duration-300',
      isCollapsed ? 'h-10' : 'h-64'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-800 cursor-pointer"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">终端</span>
          <span className="text-xs text-gray-500">({lines.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Clear terminal
            }}
            className="p-1 hover:bg-gray-700 rounded"
            title="清空终端"
          >
            <Trash2 className="w-3 h-3 text-gray-400" />
          </button>
          {isCollapsed ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Terminal content */}
      {!isCollapsed && (
        <>
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-sm"
            onClick={handleTerminalClick}
          >
            {lines.length === 0 ? (
              <div className="text-gray-500">
                终端就绪。输入命令或让 AI 执行操作。
              </div>
            ) : (
              lines.map((line) => (
                <div key={line.id} className={cn('whitespace-pre-wrap', getLineColor(line.type))}>
                  {line.type === 'input' && <span className="text-green-400">$ </span>}
                  {line.content}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center px-3 py-2 border-t border-gray-800">
            <span className="text-green-400 font-mono text-sm mr-2">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-gray-200 font-mono text-sm focus:outline-none"
              placeholder="输入命令..."
              spellCheck={false}
            />
          </form>
        </>
      )}
    </div>
  );
}

// Helper function to create terminal lines
export function createTerminalLine(
  type: TerminalLine['type'],
  content: string
): TerminalLine {
  return {
    id: Math.random().toString(36).substring(7),
    type,
    content,
    timestamp: new Date(),
  };
}
