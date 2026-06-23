'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Monitor, Smartphone, Search } from 'lucide-react';
import type { ModelConfig } from '@/types';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Close dropdown when clicking outside (desktop)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Delay to avoid immediate close from the trigger click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile]);

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isMobile]);

  const selectedModelConfig = models.find(m => m.id === selectedModel);

  // Group by provider
  const groupedModels = models.reduce((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelConfig[]>);

  // Filter models by search query
  const filteredGroupedModels = searchQuery.trim()
    ? Object.entries(groupedModels).reduce((acc, [provider, providerModels]) => {
        const q = searchQuery.toLowerCase();
        const filtered = providerModels.filter(m =>
          (m.displayName ?? m.name).toLowerCase().includes(q) ||
          m.modelId.toLowerCase().includes(q)
        );
        if (filtered.length > 0) acc[provider] = filtered;
        return acc;
      }, {} as Record<string, ModelConfig[]>)
    : groupedModels;

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleOpen = () => {
    setSearchQuery('');
    setIsOpen(prev => !prev);
  };

  // Model list content (shared)
  const modelListContent = (
    <>
      {/* Search input (mobile) */}
      {isMobile && (
        <div className="px-4 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索模型..."
              className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>
      )}
      {/* Model list */}
      <div className="overflow-y-auto flex-1 overscroll-contain">
        {Object.entries(filteredGroupedModels).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0 z-10">
              {provider}
            </div>
            {providerModels.map(model => (
              <button
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className={`w-full text-left px-4 py-3 hover:bg-accent active:bg-accent transition-colors flex items-center justify-between ${
                  selectedModel === model.id ? 'bg-accent' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{model.displayName ?? model.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{model.modelId}</div>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
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
        {models.length > 0 && Object.keys(filteredGroupedModels).length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            未找到匹配的模型
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-accent active:bg-accent transition-colors min-w-0 max-w-full"
        aria-label="选择模型"
        aria-expanded={isOpen}
      >
        <Monitor className="w-4 h-4 text-primary shrink-0 hidden md:block" />
        <Smartphone className="w-4 h-4 text-primary shrink-0 md:hidden" />
        <span className="text-sm font-medium truncate">
          {selectedModelConfig ? (selectedModelConfig.displayName ?? selectedModelConfig.name) : '选择模型'}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop: dropdown - rendered inline with click-outside detection */}
      {!isMobile && isOpen && (
        <div ref={dropdownRef} className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">选择模型</span>
          </div>
          {modelListContent}
        </div>
      )}

      {/* Mobile: full-screen overlay via Portal */}
      {isMobile && isOpen && mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={() => { setIsOpen(false); setSearchQuery(''); }}
          />
          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[9999] bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh] safe-area-pb">
            {/* Drag handle + header */}
            <div className="flex flex-col items-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mb-3" />
              <div className="flex items-center justify-between w-full px-4 pb-2">
                <span className="text-sm font-semibold">选择模型</span>
                <button
                  onClick={() => { setIsOpen(false); setSearchQuery(''); }}
                  className="p-1.5 rounded-full hover:bg-muted active:bg-muted transition-colors"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            {modelListContent}
            {/* Safe area padding for iOS */}
            <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
          </div>
        </>,
        document.body
      )}
    </>
  );
}
