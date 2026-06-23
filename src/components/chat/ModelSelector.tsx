'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, X, Check, Smartphone, Monitor } from 'lucide-react';
import type { ModelConfig } from '@/types';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => setModels(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const selectedModelConfig = models.find(m => m.id === selectedModel);

  // Group by provider
  const groupedModels = models.reduce((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelConfig[]>);

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  // Model list content (shared between desktop dropdown and mobile sheet)
  const modelListContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">选择模型</span>
        {isMobile && (
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>
      {/* Model list */}
      <div className="overflow-y-auto flex-1">
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0 z-10">
              {provider}
            </div>
            {providerModels.map(model => (
              <button
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center justify-between ${
                  selectedModel === model.id ? 'bg-accent' : ''
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{model.displayName}</div>
                  <div className="text-xs text-muted-foreground">{model.modelId}</div>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        ))}
        {models.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            暂无可用模型，请先在后台管理中添加
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors min-w-0 max-w-full"
      >
        <Monitor className="w-4 h-4 text-primary shrink-0 hidden md:block" />
        <Smartphone className="w-4 h-4 text-primary shrink-0 md:hidden" />
        <span className="text-sm font-medium truncate">
          {selectedModelConfig?.displayName || '选择模型'}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop: dropdown */}
      {!isMobile && isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col max-h-96 overflow-hidden">
            {modelListContent}
          </div>
        </>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile && isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] animate-in slide-in-from-bottom">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {modelListContent}
            {/* Safe area padding for iOS */}
            <div className="h-safe-area-inset-bottom" />
          </div>
        </>
      )}
    </>
  );
}
