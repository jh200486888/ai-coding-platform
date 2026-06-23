'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';

// ---- Types ----
export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '3:1';
export type Resolution = '1k' | '2k' | '4k';
export type Quality = 'low' | 'medium' | 'high';
export type OutputFormat = 'png' | 'webp' | 'jpeg';
export type BatchCount = 1 | 2 | 4 | 8;

export interface ImageGenParams {
  model: string;
  ratio: AspectRatio;
  resolution: Resolution;
  quality: Quality;
  style: string;
  count: BatchCount;
  outputFormat: OutputFormat;
  referenceImage: string | null;
}

interface ControlPanelProps {
  params: ImageGenParams;
  onChange: (params: ImageGenParams) => void;
}

// ---- Data ----
const RATIOS: { id: AspectRatio; label: string; w: number; h: number }[] = [
  { id: '1:1',  label: '1:1',  w: 32, h: 32 },
  { id: '3:4',  label: '3:4',  w: 27, h: 36 },
  { id: '4:3',  label: '4:3',  w: 36, h: 27 },
  { id: '16:9', label: '16:9', w: 40, h: 22 },
  { id: '9:16', label: '9:16', w: 22, h: 40 },
  { id: '3:1',  label: '3:1',  w: 44, h: 16 },
];

const RESOLUTIONS: { id: Resolution; label: string; desc: string }[] = [
  { id: '1k', label: '1K', desc: '标准' },
  { id: '2k', label: '2K', desc: '高清' },
  { id: '4k', label: '4K', desc: 'Beta' },
];

const QUALITIES: { id: Quality; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const STYLES: { id: string; label: string; prefix: string }[] = [
  { id: 'none',         label: '无预设',   prefix: '' },
  { id: 'photo',        label: '写实摄影', prefix: 'Professional photography, ultra realistic, 8k, high detail: ' },
  { id: 'illustration', label: '商业插画', prefix: 'Commercial illustration, clean vector style, vibrant colors: ' },
  { id: 'anime',        label: '动漫风格', prefix: 'Anime style, detailed illustration, vibrant: ' },
  { id: 'oil',          label: '油画质感', prefix: 'Oil painting texture, rich brushstrokes, classical art: ' },
  { id: 'watercolor',   label: '水彩画',   prefix: 'Watercolor painting, soft edges, translucent layers: ' },
  { id: 'minimal',      label: '极简设计', prefix: 'Minimalist design, clean lines, simple composition: ' },
  { id: 'cyberpunk',    label: '赛博朋克', prefix: 'Cyberpunk style, neon lights, futuristic, dark atmosphere: ' },
  { id: 'chinese',      label: '中国风',   prefix: 'Chinese traditional art style, ink painting elements, elegant: ' },
];

const COUNTS: { id: BatchCount; label: string }[] = [
  { id: 1, label: '1' },
  { id: 2, label: '2' },
  { id: 4, label: '4' },
  { id: 8, label: '8' },
];

const FORMATS: { id: OutputFormat; label: string }[] = [
  { id: 'png',  label: 'PNG' },
  { id: 'webp', label: 'WebP' },
  { id: 'jpeg', label: 'JPEG' },
];

export function getStylePrefix(styleId: string): string {
  return STYLES.find(s => s.id === styleId)?.prefix || '';
}

export function getStyleLabel(styleId: string): string {
  return STYLES.find(s => s.id === styleId)?.label || '无';
}

export { STYLES };

export function ControlPanel({ params, onChange }: ControlPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof ImageGenParams>(key: K, value: ImageGenParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const handleFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update('referenceImage', reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  }, [handleFile]);

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-5">
      {/* Model */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">模型</h3>
        <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs">
          <span className="font-medium text-primary">GPT Image 2</span>
          <span className="text-muted-foreground ml-2">最新一代</span>
        </div>
      </section>

      {/* Aspect Ratio */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">尺寸比例</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {RATIOS.map(s => (
            <button
              key={s.id}
              onClick={() => update('ratio', s.id)}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all ${
                params.ratio === s.id
                  ? 'bg-primary/10 border border-primary text-primary'
                  : 'bg-muted/30 border border-border text-muted-foreground hover:border-muted-foreground/50'
              }`}
            >
              <div
                className="border rounded-sm"
                style={{
                  width: s.w * 0.7,
                  height: s.h * 0.7,
                  borderColor: params.ratio === s.id ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: params.ratio === s.id ? 'var(--color-primary)' : 'transparent',
                  opacity: params.ratio === s.id ? 0.3 : 0.5,
                }}
              />
              <span className="text-[10px]">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Resolution */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">分辨率</h3>
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTIONS.map(r => (
            <button
              key={r.id}
              onClick={() => update('resolution', r.id)}
              className={`px-2 py-2 rounded-lg text-center transition-all ${
                params.resolution === r.id
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="text-xs font-medium">{r.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>
        {params.resolution === '4k' && (
          <p className="text-[10px] text-amber-400 mt-1.5">4K 为 Beta 功能，使用 2K 源图 + 后期放大</p>
        )}
      </section>

      {/* Quality */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">画质</h3>
        <div className="flex gap-2">
          {QUALITIES.map(q => (
            <button
              key={q.id}
              onClick={() => update('quality', q.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                params.quality === q.id
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </section>

      {/* Style */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">风格预设</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => update('style', s.id)}
              className={`px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                params.style === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Count */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">生成数量</h3>
        <div className="flex gap-2">
          {COUNTS.map(c => (
            <button
              key={c.id}
              onClick={() => update('count', c.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                params.count === c.id
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Output Format */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">输出格式</h3>
        <div className="flex gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => update('outputFormat', f.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                params.outputFormat === f.id
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Reference Image */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">参考图 (图生图)</h3>
        {params.referenceImage ? (
          <div className="relative group">
            <img
              src={params.referenceImage}
              alt="Reference"
              className="w-full h-28 object-cover rounded-lg border border-border"
            />
            <button
              onClick={() => update('referenceImage', null)}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-destructive/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50'
            }`}
          >
            <Upload className="w-4 h-4 mb-1" />
            <span className="text-[11px]">拖拽或点击上传</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </section>
    </div>
  );
}
