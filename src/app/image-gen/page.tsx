'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Code2, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ControlPanel, getStylePrefix, type ImageGenParams } from '@/components/image-gen/ControlPanel';
import { ImageDisplay, type GeneratedImage } from '@/components/image-gen/ImageDisplay';
import { PromptInput } from '@/components/image-gen/PromptInput';
import { GenerationHistory, loadHistory, saveHistory, clearHistory } from '@/components/image-gen/GenerationHistory';

const DEFAULT_PARAMS: ImageGenParams = {
  model: 'gpt-image-2',
  ratio: '1:1',
  resolution: '1k',
  quality: 'low',
  style: 'none',
  count: 1,
  outputFormat: 'png',
  referenceImage: null,
};

export default function ImageGenPage() {
  const [params, setParams] = useState<ImageGenParams>(DEFAULT_PARAMS);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: params.model,
          size: params.ratio,
          resolution: params.resolution,
          quality: params.quality,
          n: params.count,
          output_format: params.outputFormat,
          referenceImage: params.referenceImage || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '生成失败，请重试');
        return;
      }

      if (data.success && data.images) {
        const newImages: GeneratedImage[] = data.images.map((img: { id: string; url: string; revised_prompt: string }) => ({
          id: img.id,
          url: img.url,
          prompt,
          revisedPrompt: img.revised_prompt,
          model: data.model || params.model,
          size: data.size || params.ratio,
          quality: data.quality || params.quality,
          timestamp: Date.now(),
        }));

        setImages(newImages);

        // Update history
        setHistory(prev => {
          const updated = [...newImages, ...prev].slice(0, 50);
          saveHistory(updated);
          return updated;
        });
      }
    } catch (err) {
      setError('网络错误，请检查连接后重试');
    } finally {
      setIsGenerating(false);
    }
  }, [params]);

  const handleHistorySelect = useCallback((image: GeneratedImage) => {
    setImages([image]);
  }, []);

  const handleHistoryClear = useCallback(() => {
    setHistory([]);
    clearHistory();
  }, []);

  const handleEdit = useCallback((image: GeneratedImage) => {
    // Set the selected image as reference for editing
    setParams(prev => ({ ...prev, referenceImage: image.url }));
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-semibold">AI 图片生成</h1>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
            对话
          </Link>
          <Link href="/workspace" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors">
            <Code2 className="w-3.5 h-3.5" />
            工作区
          </Link>
          <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors">
            <Settings className="w-3.5 h-3.5" />
            管理
          </Link>
        </nav>
      </header>

      {/* Main content: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Control Panel */}
        {panelOpen && <ControlPanel params={params} onChange={setParams} />}

        {/* Center: Display + Input */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toggle panel button */}
          <div className="flex items-center px-3 py-1.5 border-b border-border/50">
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {panelOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
              {panelOpen ? '收起面板' : '展开面板'}
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 px-4 py-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Image display area */}
          <ImageDisplay
            images={images}
            isGenerating={isGenerating}
            generatingCount={params.count}
            onRegenerate={handleGenerate}
            onEdit={handleEdit}
          />

          {/* Prompt input */}
          <PromptInput
            params={params}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>

        {/* Right: History */}
        <GenerationHistory
          history={history}
          onSelect={handleHistorySelect}
          onClear={handleHistoryClear}
        />
      </div>
    </div>
  );
}
