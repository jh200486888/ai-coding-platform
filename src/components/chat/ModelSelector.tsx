'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ModelConfig } from '@/types';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => setModels(data))
      .catch(console.error);
  }, []);

  const selectedModelConfig = models.find(m => m.id === selectedModel);

  // 按厂商分组
  const groupedModels = models.reduce((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelConfig[]>);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
      >
        <span className="text-sm font-medium">
          {selectedModelConfig?.displayName || '选择模型'}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider}>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                {provider}
              </div>
              {providerModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${
                    selectedModel === model.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="text-sm font-medium">{model.displayName}</div>
                  <div className="text-xs text-muted-foreground">{model.modelId}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
