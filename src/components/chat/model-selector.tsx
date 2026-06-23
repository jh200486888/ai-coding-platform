'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { ModelConfig } from '@/lib/types';

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

export default function ModelSelector({ models, selectedModel, onSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const enabledModels = models.filter((m) => m.is_enabled === 1);
  const currentModel = enabledModels.find((m) => m.model_id === selectedModel) || enabledModels[0];

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-accent transition-all text-sm"
      >
        <Sparkles size={14} className="text-primary" />
        <span className="font-medium">{currentModel?.display_name || '选择模型'}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 max-h-80 overflow-y-auto">
            {enabledModels.map((model) => (
              <button
                key={model.model_id}
                onClick={() => {
                  onSelect(model.model_id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  model.model_id === selectedModel
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    model.model_id === selectedModel ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`} />
                  <span className="font-medium text-sm">{model.display_name}</span>
                </div>
                {model.description && (
                  <p className="text-xs text-muted-foreground mt-1 ml-4">{model.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
