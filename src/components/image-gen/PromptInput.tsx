'use client';

import { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { ImageGenParams } from './ControlPanel';

interface PromptInputProps {
  params: ImageGenParams;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
}

interface StyleOption { id: string; label: string; prefix: string; enabled: boolean; }

export function PromptInput({ params, onGenerate, isGenerating }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [styles, setStyles] = useState<StyleOption[]>([]);

  useEffect(() => {
    fetch('/api/image-gen-config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.styles) {
          setStyles(data.data.styles.filter((s: StyleOption) => s.enabled));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = () => {
    if (!prompt.trim() || isGenerating) return;
    const styleEntry = styles.find(s => s.id === params.style);
    const fullPrompt = (styleEntry?.prefix || '') + prompt.trim();
    onGenerate(fullPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const styleName = styles.find(s => s.id === params.style)?.label || params.style;
  const summary = `${params.model} | ${params.ratio} | ${params.resolution.toUpperCase()} | ${params.quality} | ${styleName} | ${params.count}张 | ${params.outputFormat.toUpperCase()}`;

  return (
    <div className="border-t border-border bg-card/50 p-4">
      {/* Parameter summary */}
      <div className="flex items-center gap-2 mb-2 text-[11px] text-muted-foreground overflow-x-auto">
        <span className="px-2 py-0.5 bg-muted/50 rounded whitespace-nowrap">{summary}</span>
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你想生成的图片..."
          rows={2}
          className="flex-1 bg-input border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/50"
          disabled={isGenerating}
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isGenerating}
          className="self-end px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">生成中</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span className="text-sm">生成</span>
            </>
          )}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/50 mt-1.5">Ctrl + Enter 快速发送</p>
    </div>
  );
}
