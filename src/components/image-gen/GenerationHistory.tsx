'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { GeneratedImage } from './ImageDisplay';

const STORAGE_KEY = 'image-gen-history';
const MAX_HISTORY = 50;

interface GenerationHistoryProps {
  history: GeneratedImage[];
  onSelect: (image: GeneratedImage) => void;
  onClear: () => void;
}

export function GenerationHistory({ history, onSelect, onClear }: GenerationHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-[200px] flex-shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border sticky top-0 bg-card z-10">
        <h3 className="text-xs font-medium text-muted-foreground">生成历史</h3>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          清空
        </button>
      </div>
      <div className="p-2 space-y-2">
        {history.map(img => (
          <button
            key={img.id}
            onClick={() => onSelect(img)}
            className="w-full group relative rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
          >
            <img
              src={img.url}
              alt={img.prompt}
              className="w-full aspect-square object-cover"
            />
            <div className="p-1.5 bg-card/90">
              <p className="text-[10px] text-foreground truncate">{img.prompt}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(img.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper functions for localStorage persistence
export function loadHistory(): GeneratedImage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GeneratedImage[];
  } catch {
    return [];
  }
}

export function saveHistory(history: GeneratedImage[]) {
  if (typeof window === 'undefined') return;
  try {
    // Only store url, prompt, model, size, timestamp (not revisedPrompt to save space)
    const slim = history.slice(0, MAX_HISTORY).map(img => ({
      id: img.id,
      url: img.url,
      prompt: img.prompt,
      model: img.model,
      size: img.size,
      quality: img.quality,
      timestamp: img.timestamp,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    // localStorage full - trim older entries
    try {
      const trimmed = history.slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // give up silently
    }
  }
}

export function clearHistory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
