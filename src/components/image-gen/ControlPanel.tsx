'use client';
import { toast } from 'sonner';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

// ---- Types (relaxed to accept dynamic config) ----
export interface ImageGenParams {
  model: string;
  ratio: string;
  resolution: string;
  quality: string;
  style: string;
  count: number;
  outputFormat: string;
  referenceImage: string | null;
}

interface ControlPanelProps {
  params: ImageGenParams;
  onChange: (params: ImageGenParams) => void;
}

interface ModelOption { id: string; name: string; provider: string; desc: string; maxN: number; supportsEdit: boolean; enabled: boolean; }
interface RatioOption { id: string; label: string; w: number; h: number; enabled: boolean; }
interface ResolutionOption { id: string; label: string; desc: string; enabled: boolean; }
interface QualityOption { id: string; label: string; enabled: boolean; }
interface StyleOption { id: string; label: string; prefix: string; enabled: boolean; }
interface CountOption { id: number; label: string; enabled: boolean; }
interface FormatOption { id: string; label: string; enabled: boolean; }

interface ImageGenConfig {
  models: ModelOption[];
  ratios: RatioOption[];
  resolutions: ResolutionOption[];
  qualities: QualityOption[];
  styles: StyleOption[];
  counts: CountOption[];
  formats: FormatOption[];
  maxUploadSizeMB: number;
  defaultModel: string;
  defaultRatio: string;
  defaultResolution: string;
  defaultQuality: string;
  defaultStyle: string;
  defaultCount: number;
  defaultFormat: string;
}

// Fallback defaults (used while loading or if API fails)
const FALLBACK: ImageGenConfig = {
  models: [
    { id: 'qwen-image-2.0', name: '通义万相 2.0', provider: '阿里百炼', desc: '快速生图', maxN: 4, supportsEdit: false, enabled: true },
    { id: 'qwen-image-2.0-pro', name: '通义万相 2.0 Pro', provider: '阿里百炼', desc: '高清生图', maxN: 4, supportsEdit: false, enabled: true },
    { id: 'wan2.6-t2i', name: '万相 2.6', provider: '阿里百炼', desc: '推荐版', maxN: 4, supportsEdit: false, enabled: true },
    { id: 'wanx-v1-edit', name: '万相图生图', provider: '阿里百炼', desc: '参考图改图', maxN: 4, supportsEdit: true, enabled: true },
    { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'OpenAI', desc: '需API Key', maxN: 10, supportsEdit: true, enabled: true },
    { id: 'SeedDream-3.0', name: '即梦 3.0', provider: '火山引擎', desc: '中文理解极强', maxN: 4, supportsEdit: false, enabled: true },
  ],
  ratios: [
    { id: '1:1', label: '1:1', w: 32, h: 32, enabled: true },
    { id: '3:4', label: '3:4', w: 27, h: 36, enabled: true },
    { id: '4:3', label: '4:3', w: 36, h: 27, enabled: true },
    { id: '16:9', label: '16:9', w: 40, h: 22, enabled: true },
    { id: '9:16', label: '9:16', w: 22, h: 40, enabled: true },
    { id: '3:1', label: '3:1', w: 44, h: 16, enabled: true },
  ],
  resolutions: [
    { id: '1k', label: '1K', desc: '标准', enabled: true },
    { id: '2k', label: '2K', desc: '高清', enabled: true },
    { id: '4k', label: '4K', desc: 'Beta', enabled: true },
  ],
  qualities: [
    { id: 'low', label: 'Low', enabled: true },
    { id: 'medium', label: 'Medium', enabled: true },
    { id: 'high', label: 'High', enabled: true },
  ],
  styles: [
    { id: 'none', label: '无预设', prefix: '', enabled: true },
    { id: 'photo', label: '写实摄影', prefix: 'Professional photography, ultra realistic, 8k, high detail: ', enabled: true },
    { id: 'illustration', label: '商业插画', prefix: 'Commercial illustration, clean vector style, vibrant colors: ', enabled: true },
    { id: 'anime', label: '动漫风格', prefix: 'Anime style, detailed illustration, vibrant: ', enabled: true },
    { id: 'oil', label: '油画质感', prefix: 'Oil painting texture, rich brushstrokes, classical art: ', enabled: true },
    { id: 'watercolor', label: '水彩画', prefix: 'Watercolor painting, soft edges, translucent layers: ', enabled: true },
    { id: 'minimal', label: '极简设计', prefix: 'Minimalist design, clean lines, simple composition: ', enabled: true },
    { id: 'cyberpunk', label: '赛博朋克', prefix: 'Cyberpunk style, neon lights, futuristic, dark atmosphere: ', enabled: true },
    { id: 'chinese', label: '中国风', prefix: 'Chinese traditional art style, ink painting elements, elegant: ', enabled: true },
  ],
  counts: [
    { id: 1, label: '1', enabled: true },
    { id: 2, label: '2', enabled: true },
    { id: 4, label: '4', enabled: true },
    { id: 8, label: '8', enabled: true },
  ],
  formats: [
    { id: 'png', label: 'PNG', enabled: true },
    { id: 'webp', label: 'WebP', enabled: true },
    { id: 'jpeg', label: 'JPEG', enabled: true },
  ],
  maxUploadSizeMB: 10,
  defaultModel: 'qwen-image-2.0',
  defaultRatio: '1:1',
  defaultResolution: '1k',
  defaultQuality: 'low',
  defaultStyle: 'none',
  defaultCount: 1,
  defaultFormat: 'png',
};

export function getStylePrefix(styleId: string): string {
  // Will be overridden by dynamic styles, but keep as fallback
  return FALLBACK.styles.find(s => s.id === styleId)?.prefix || '';
}

export function getStyleLabel(styleId: string): string {
  return FALLBACK.styles.find(s => s.id === styleId)?.label || '无';
}

export { FALLBACK as STYLES };

export function ControlPanel({ params, onChange }: ControlPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ImageGenConfig>(FALLBACK);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch config from API
  useEffect(() => {
    fetch('/api/image-gen-config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setConfig(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof ImageGenParams>(key: K, value: ImageGenParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const handleFile = useCallback((file: File) => {
    const maxSize = config.maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.warning(`文件大小不能超过 ${config.maxUploadSizeMB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update('referenceImage', reader.result as string);
    reader.readAsDataURL(file);
  }, [config.maxUploadSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  }, [handleFile]);

  // Enabled items from config
  const enabledModels = config.models.filter(m => m.enabled);
  const enabledRatios = config.ratios.filter(r => r.enabled);
  const enabledResolutions = config.resolutions.filter(r => r.enabled);
  const enabledQualities = config.qualities.filter(q => q.enabled);
  const enabledStyles = config.styles.filter(s => s.enabled);
  const enabledCounts = config.counts.filter(c => c.enabled);
  const enabledFormats = config.formats.filter(f => f.enabled);

  const currentModel = enabledModels.find(m => m.id === params.model) || enabledModels[0];
  const availableCounts = enabledCounts.filter(c => c.id <= (currentModel?.maxN || 4));

  if (loading) {
    return (
      <div className="w-[280px] flex-shrink-0 border-r border-border bg-card flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-5">
      {/* Model */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">模型</h3>
        <select
          value={params.model}
          onChange={(e) => update('model', e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary transition-colors"
        >
          {enabledModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider}) - {m.desc}
            </option>
          ))}
        </select>
        {currentModel?.supportsEdit && (
          <p className="text-[10px] text-muted-foreground mt-1">✅ 支持上传参考图，AI 按要求改图</p>
        )}
      </section>

      {/* Aspect Ratio */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">尺寸比例</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {enabledRatios.map(s => (
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
          {enabledResolutions.map(r => (
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
          {enabledQualities.map(q => (
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
          {enabledStyles.map(s => (
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
          {availableCounts.map(c => (
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
          {enabledFormats.map(f => (
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
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">参考图 (最大{config.maxUploadSizeMB}MB)</h3>
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
