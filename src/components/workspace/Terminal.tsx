'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface TerminalProps {
  output: string[];
  onCommand: (command: string) => void;
  onClose: () => void;
}

export function Terminal({ output, onCommand, onClose }: TerminalProps) {
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onCommand(input.trim());
      setInput('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm">
      {/* 标题栏 */}
      <div className="h-8 flex items-center justify-between px-4 bg-[#2d2d2d] border-b border-[#3e3e3e]">
        <span className="text-xs">终端</span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 输出区域 */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {output.length === 0 ? (
          <div className="text-muted-foreground">
            终端就绪。输入命令开始执行。
          </div>
        ) : (
          output.map((line, i) => (
            <div
              key={i}
              className={`${
                line.startsWith('$')
                  ? 'text-green-400'
                  : line.includes('error') || line.includes('Error')
                  ? 'text-red-400'
                  : line.includes('warning') || line.includes('Warning')
                  ? 'text-yellow-400'
                  : ''
              }`}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="border-t border-[#3e3e3e] p-2">
        <div className="flex items-center gap-2">
          <span className="text-green-400">$</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[#d4d4d4]"
            placeholder="输入命令..."
            autoFocus
          />
        </div>
      </form>
    </div>
  );
}
