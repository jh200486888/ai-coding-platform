'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { ModelConfig } from '@/lib/types';

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

// 厂商名称映射
const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  zhipu: '智谱',
  kimi: 'Kimi',
  qwen: '通义千问',
  baidu: '文心一言',
  spark: '讯飞星火',
  minimax: 'MiniMax',
  yi: '零一万物',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  meta: 'Meta',
};

export default function ModelSelector({ models, selectedModel, onSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const enabledModels = models.filter((m) => m.is_enabled === 1);
  
  // 优先使用外部传入的 selectedModel，否则选第一个启用模型
  const defaultModel = enabledModels.find((m) => m.model_id === selectedModel) || enabledModels[0];
  const currentModel = enabledModels.find((m) => m.model_id === selectedModel) || defaultModel;

  // 按厂商分组
  const groupedModels = enabledModels.reduce((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelConfig[]>);

  // 厂商排序：国内优先
  const providerOrder = ['deepseek', 'zhipu', 'kimi', 'qwen', 'baidu', 'spark', 'minimax', 'yi', 'openai', 'anthropic', 'google', 'meta'];
  const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
    const indexA = providerOrder.indexOf(a);
    const indexB = providerOrder.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

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
        <div className="absolute top-full left-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 max-h-96 overflow-y-auto">
            {sortedProviders.map((provider) => (
              <div key={provider} className="mb-2">
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {PROVIDER_NAMES[provider] || provider}
                </div>
                {groupedModels[provider].map((model) => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
