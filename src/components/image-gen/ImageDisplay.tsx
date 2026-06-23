'use client';

import { useState } from 'react';
import { Download, RefreshCw, Edit3, X, ZoomIn, Sparkles } from 'lucide-react';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  revisedPrompt?: string;
  model: string;
  size: string;
  quality: string;
  timestamp: number;
}

interface ImageDisplayProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  generatingCount?: number;
  onRegenerate?: (prompt: string) => void;
  onEdit?: (image: GeneratedImage) => void;
}

function downloadImage(dataUrl: string, filename: string) {
  fetch(dataUrl)
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    });
}

export function ImageDisplay({ images, isGenerating, generatingCount = 1, onRegenerate, onEdit }: ImageDisplayProps) {
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [zoom, setZoom] = useState(1);

  const gridCols = images.length === 1
    ? 'grid-cols-1 max-w-lg'
    : images.length <= 4
      ? 'grid-cols-2 max-w-3xl'
      : 'grid-cols-3 max-w-5xl';

  const openPreview = (img: GeneratedImage) => {
    setPreviewImage(img);
    setZoom(1);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {/* Empty state */}
        {images.length === 0 && !isGenerating && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-2">开始创作</h3>
              <p className="text-sm">输入描述，GPT Image 2 将为你生成图片</p>
            </div>
          </div>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <div className={`grid ${gridCols} gap-3 mx-auto`}>
            {images.map(img => (
              <div
                key={img.id}
                className="group relative rounded-xl overflow-hidden bg-muted/30 border border-border animate-fade-in"
              >
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full h-auto cursor-pointer"
                  onClick={() => openPreview(img)}
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end opacity-0 group-hover:opacity-100">
                  <div className="w-full p-3">
                    <p className="text-xs text-white/80 truncate mb-2">{img.revisedPrompt || img.prompt}</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadImage(img.url, `generated-${img.id}.png`); }}
                        className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors"
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {onRegenerate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRegenerate(img.prompt); }}
                          className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors"
                          title="重新生成"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(img); }}
                          className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors"
                          title="以此图编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generating skeleton */}
        {isGenerating && (
          <div className={`grid ${images.length <= 1 ? 'grid-cols-1 max-w-lg' : images.length <= 4 ? 'grid-cols-2 max-w-3xl' : 'grid-cols-3 max-w-5xl'} gap-3 mx-auto mt-3`}>
            {Array.from({ length: generatingCount }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="aspect-square rounded-xl bg-muted/30 border border-border overflow-hidden relative"
              >
                <div className="w-full h-full animate-pulse bg-gradient-to-br from-primary/5 via-muted/20 to-primary/5" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Zoom controls */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z - 0.25)); }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
            >
              -
            </button>
            <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">{Math.round(zoom * 100)}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.25)); }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
            >
              +
            </button>
          </div>

          <div className="max-w-[90vw] max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
            <img
              src={previewImage.url}
              alt={previewImage.prompt}
              className="max-w-full max-h-[80vh] object-contain rounded-lg transition-transform"
              style={{ transform: `scale(${zoom})` }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg">
              <p className="text-white text-sm">{previewImage.revisedPrompt || previewImage.prompt}</p>
              {previewImage.revisedPrompt && previewImage.revisedPrompt !== previewImage.prompt && (
                <p className="text-white/50 text-xs mt-1">原始提示: {previewImage.prompt}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-white/60 text-xs">
                <span>{previewImage.model}</span>
                <span>{previewImage.size}</span>
                <span>{previewImage.quality}</span>
                <span>{new Date(previewImage.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
