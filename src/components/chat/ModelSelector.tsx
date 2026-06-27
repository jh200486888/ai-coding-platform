'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Monitor, Smartphone, Search } from 'lucide-react';
import { getAllModels, getModelsByProvider } from '@/lib/models';
const AUTO_MODEL = { id: 'auto', name: '自动选择', provider: 'auto', description: '系统自动选择最优模型' };


interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 直接用前端模型列表，不走数据库
  const models = [AUTO_MODEL, ...getAllModels()];
  const providers = [
    { id: 'auto', name: '自动选择', models: [AUTO_MODEL] },
    ...getModelsByProvider(),
  ];

  useEffect(() => {
    setMounted(true);
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

  const selectedModelConfig = selectedModel === 'auto' 
    ? AUTO_MODEL 
    : models.find(m => m.id === selectedModel);

  // Filter models by search query
  const filteredProviders = searchQuery.trim()
    ? providers.map(p => ({
        ...p,
        models: p.models.filter(m =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(p => p.models.length > 0)
    : providers;

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
      {/* Search input */}
      {(
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
        {filteredProviders.map(provider => (
          <div key={provider.id}>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0 z-10">
              {provider.name}
            </div>
            {provider.models.map(model => (
              <button
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className={`w-full text-left px-4 py-3 hover:bg-accent active:bg-accent transition-colors flex items-center justify-between ${
                  selectedModel === model.id ? 'bg-accent' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{model.name}</div>
                  {model.description && (
                    <div className="text-xs text-muted-foreground truncate">{model.description}</div>
                  )}
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
            暂无可用模型
          </div>
        )}
        {models.length > 0 && filteredProviders.length === 0 && (
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
          {selectedModelConfig ? selectedModelConfig.name : '选择模型'}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop: dropdown */}
      {!isMobile && isOpen && (
        <div ref={dropdownRef} className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col max-h-96 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">选择模型</span>
          </div>
          {modelListContent}
        </div>
      )}

      {/* Mobile: full-screen overlay via Portal */}
      {isMobile && isOpen && mounted && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={() => { setIsOpen(false); setSearchQuery(''); }}
          />
          <div className="fixed inset-x-0 bottom-0 z-[9999] bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh] safe-area-pb">
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
            <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
          </div>
        </>,
        document.body
      )}
    </>
  );
}
