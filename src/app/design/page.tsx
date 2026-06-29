"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Palette, Plus, Search, Sparkles, Layout, Image, Type,
  FileImage, Video, Presentation, ArrowRight, Clock,
  MessageSquare, Code2, Shapes, Upload, Layers, X,
  Settings2, Globe, Box, ArrowUp, ChevronDown, Loader2,
  PanelLeftClose, PanelLeftOpen, ImagePlus, Wand2, Download
} from "lucide-react";
import { ControlPanel, type ImageGenParams } from "@/components/image-gen/ControlPanel";
import { ImageDisplay, type GeneratedImage } from "@/components/image-gen/ImageDisplay";
import { PromptInput } from "@/components/image-gen/PromptInput";
import { GenerationHistory, loadHistory, saveHistory, clearHistory } from "@/components/image-gen/GenerationHistory";

interface DesignProject {
  id: string;
  title: string;
  type: string;
  thumbnail?: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface Template {
  id: string;
  name: string;
  category_id: string;
  prompt: string;
  thumbnail: string;
  sort_order: number;
}

interface ModelOption {
  modelId: string;
  name: string;
  provider: string;
  type: string;
}

const ICON_MAP: Record<string, any> = {
  Sparkles, Image, Type, Presentation, Layout, Video, Shapes, Upload, Layers,
};

function CategoryIcon({ name }: { name: string }) {
  const IconComp = ICON_MAP[name] || Sparkles;
  return <IconComp className="w-4 h-4" />;
}

type DesignMode = "ai" | "quick";

function DesignPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "quick" ? "quick" : "ai";
  const [mode, setMode] = useState<DesignMode>(initialMode);
  const [input, setInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isCreating, setIsCreating] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== Quick Gen State =====
  const [params, setParams] = useState<ImageGenParams>({
    model: '', ratio: '1:1', resolution: '1k', quality: 'low',
    style: 'none', count: 1, outputFormat: 'png', referenceImage: null,
  });
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Load history
  useEffect(() => { setHistory(loadHistory()); }, []);

  // Fetch image gen config
  useEffect(() => {
    fetch('/api/image-gen-config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const cfg = data.data;
          setParams(prev => ({
            ...prev,
            model: cfg.defaultModel || prev.model || cfg.models?.[0]?.id || '',
            ratio: cfg.defaultRatio || prev.ratio,
            resolution: cfg.defaultResolution || prev.resolution,
            quality: cfg.defaultQuality || prev.quality,
            style: cfg.defaultStyle || prev.style,
            count: cfg.defaultCount || prev.count,
            outputFormat: cfg.defaultFormat || prev.outputFormat,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setGenError(null);
    try {
      const response = await fetch('/api/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, model: params.model, size: params.ratio,
          resolution: params.resolution, quality: params.quality,
          n: params.count, output_format: params.outputFormat,
          referenceImage: params.referenceImage || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) { setGenError(data.error || '生成失败'); return; }
      if (data.success && data.images) {
        const newImages: GeneratedImage[] = data.images.map((img: any) => ({
          id: img.id, url: img.url, prompt,
          revisedPrompt: img.revised_prompt, model: data.model || params.model,
          size: data.size || params.ratio, quality: data.quality || params.quality,
          timestamp: Date.now(),
        }));
        setImages(newImages);
        setHistory(prev => { const updated = [...newImages, ...prev].slice(0, 50); saveHistory(updated); return updated; });
      }
    } catch { setGenError('网络错误'); }
    finally { setIsGenerating(false); }
  }, [params]);

  // Load design config + models
  useEffect(() => {
    fetch("/api/design/config")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setCategories(data.categories || []); setTemplates(data.templates || []); }
        setConfigLoading(false);
      })
      .catch(() => setConfigLoading(false));

    fetch("/api/models")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.models) {
          setModels(data.models.map((m: any) => ({
            modelId: m.modelId || m.id, name: m.name || m.modelId,
            provider: m.provider, type: m.provider?.includes("image") ? "image" : "text",
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/design")
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setProjects(Array.isArray(data.data) ? data.data : []))
      .catch(() => {});
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setReferenceImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async (prompt?: string) => {
    const userPrompt = prompt || input.trim();
    if (!userPrompt) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: userPrompt.slice(0, 50), prompt: userPrompt,
          referenceImage, model: selectedModel !== "auto" ? selectedModel : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const p = new URLSearchParams();
        p.set("prompt", userPrompt);
        if (referenceImage) p.set("hasRef", "1");
        if (selectedModel !== "auto") p.set("model", selectedModel);
        router.push(`/design/${data.data?.id || "new"}?${p.toString()}`);
      }
    } catch (e) { console.error(e); }
    finally { setIsCreating(false); }
  };

  const filteredTemplates = activeCategory === "all" ? templates : templates.filter(t => t.category_id === activeCategory);

  return (
    <div className="min-h-screen bg-[#0f0f14] text-[#f1f5f9]">
      {/* Header */}
      <header className="border-b border-[#1e293b] bg-[#16161e]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">AI 编程平台</span>
            </Link>
            <span className="text-[#1e293b]">|</span>
            <div className="flex items-center gap-1.5 text-[#a78bfa]">
              <Palette className="w-5 h-5" />
              <span className="font-medium">设计工坊</span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-[#1e1e2a] transition-colors text-[#94a3b8]">
              <Code2 className="w-4 h-4" />
              <span className="hidden sm:inline">编程</span>
            </Link>
            <Link href="/design" className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[#7c3aed] text-white">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">设计</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Mode Tabs */}
      <div className="border-b border-[#1e293b] bg-[#16161e]/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setMode("ai")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                mode === "ai"
                  ? "border-[#7c3aed] text-[#a78bfa]"
                  : "border-transparent text-[#64748b] hover:text-[#94a3b8]"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              AI 设计
              <span className="text-xs text-[#64748b] font-normal">对话式</span>
            </button>
            <button
              onClick={() => setMode("quick")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                mode === "quick"
                  ? "border-[#7c3aed] text-[#a78bfa]"
                  : "border-transparent text-[#64748b] hover:text-[#94a3b8]"
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              快速生图
              <span className="text-xs text-[#64748b] font-normal">参数式</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== AI Design Mode ===== */}
      {mode === "ai" && (
        <main className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="py-16 md:py-24 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              <span className="bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#7c3aed] bg-clip-text text-transparent">设计工坊</span>
              <span className="text-[#94a3b8] text-lg md:text-xl ml-2 font-normal">让设计变简单</span>
            </h1>
            <p className="text-[#64748b] mb-8 text-sm">AI 驱动，描述即可生成设计稿和图片</p>

            {/* Central Input Box */}
            <div className="max-w-2xl mx-auto relative">
              <div className="bg-[#16161e] border border-[#1e293b] rounded-2xl focus-within:border-[#7c3aed]/50 focus-within:shadow-lg focus-within:shadow-[#7c3aed]/10 transition-all overflow-hidden">
                {referenceImage && (
                  <div className="px-4 pt-3 flex items-center gap-2">
                    <div className="relative group">
                      <img src={referenceImage} alt="Reference" className="h-16 rounded-lg object-cover" />
                      <button onClick={() => { setReferenceImage(null); setReferenceFileName(""); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                    <span className="text-xs text-[#64748b] truncate max-w-[120px]">{referenceFileName}</span>
                  </div>
                )}
                <div className="flex items-center px-4 py-3">
                  <Sparkles className="w-5 h-5 text-[#7c3aed] mr-3 shrink-0" />
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreate()}
                    placeholder="让 AI 制作你的设计..."
                    className="flex-1 bg-transparent outline-none text-[#f1f5f9] placeholder-[#64748b] text-sm md:text-base" />
                </div>
                <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e293b]">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded-lg hover:bg-[#1e1e2a] text-[#64748b] hover:text-[#94a3b8] transition-colors" title="上传参考图">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    <button className="p-1.5 rounded-lg hover:bg-[#1e1e2a] text-[#64748b] hover:text-[#94a3b8] transition-colors" title="网页内容">
                      <Globe className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-[#1e1e2a] text-[#64748b] hover:text-[#94a3b8] transition-colors" title="3D 元素">
                      <Box className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button onClick={() => setShowModelPicker(!showModelPicker)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-lg text-xs text-[#94a3b8] transition-colors">
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>{selectedModel === "auto" ? "模型偏好" : models.find(m => m.modelId === selectedModel)?.name || selectedModel}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {showModelPicker && (
                        <div className="absolute right-0 bottom-full mb-1 w-56 bg-[#1e1e2a] border border-[#2e2e3a] rounded-xl shadow-2xl z-50 overflow-hidden">
                          <div className="p-2 space-y-0.5 max-h-60 overflow-y-auto">
                            <button onClick={() => { setSelectedModel("auto"); setShowModelPicker(false); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedModel === "auto" ? "bg-[#7c3aed]/20 text-[#a78bfa]" : "text-[#94a3b8] hover:bg-[#2a2a3a]"}`}>
                              <div className="font-medium">自动选择</div>
                              <div className="text-xs text-[#64748b]">根据意图智能路由</div>
                            </button>
                            {models.filter(m => m.type === "text").map(m => (
                              <button key={m.modelId} onClick={() => { setSelectedModel(m.modelId); setShowModelPicker(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedModel === m.modelId ? "bg-[#7c3aed]/20 text-[#a78bfa]" : "text-[#94a3b8] hover:bg-[#2a2a3a]"}`}>
                                <div className="font-medium">{m.name}</div>
                                <div className="text-xs text-[#64748b]">{m.provider}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleCreate()} disabled={!input.trim() || isCreating}
                      className="px-4 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
                      {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      {isCreating ? "生成中..." : "生成"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Tags */}
          {!configLoading && categories.length > 0 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? "bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20"
                      : "bg-[#16161e] text-[#94a3b8] border border-[#1e293b] hover:border-[#7c3aed]/30 hover:text-[#a78bfa]"
                  }`}>
                  <CategoryIcon name={cat.icon} />
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Template Grid */}
          {!configLoading && filteredTemplates.length > 0 && (
            <div className="py-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileImage className="w-5 h-5 text-[#a78bfa]" /> 快速开始
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredTemplates.map(template => (
                  <button key={template.id} onClick={() => handleCreate(template.prompt)}
                    className="group relative bg-[#16161e] border border-[#1e293b] hover:border-[#7c3aed]/40 rounded-xl p-4 text-left transition-all hover:shadow-lg hover:shadow-[#7c3aed]/5 hover:-translate-y-0.5">
                    <div className="aspect-[4/3] bg-gradient-to-br from-[#1e1e2a] to-[#16162a] rounded-lg mb-3 flex items-center justify-center">
                      {template.thumbnail ? (
                        <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Palette className="w-8 h-8 text-[#7c3aed]/30 group-hover:text-[#7c3aed]/50 transition-colors" />
                      )}
                    </div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-[#64748b] mt-1 line-clamp-1">{template.prompt}</div>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-7 h-7 rounded-full bg-[#7c3aed] flex items-center justify-center">
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Projects */}
          {projects.length > 0 && (
            <div className="py-6 pb-12">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#a78bfa]" /> 最近项目
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {projects.map(project => (
                  <Link key={project.id} href={`/design/${project.id}`}
                    className="group bg-[#16161e] border border-[#1e293b] hover:border-[#7c3aed]/40 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-[#7c3aed]/5">
                    <div className="aspect-[4/3] bg-[#1e1e2a] rounded-lg mb-3 flex items-center justify-center">
                      <FileImage className="w-8 h-8 text-[#7c3aed]/20" />
                    </div>
                    <div className="font-medium text-sm truncate">{project.title}</div>
                    <div className="text-xs text-[#64748b] mt-1">{project.type}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ===== Quick Image Gen Mode ===== */}
      {mode === "quick" && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 97px)" }}>
          {/* Error banner */}
          {genError && (
            <div className="mx-4 mt-3 px-4 py-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {genError}
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            {/* Left: Control Panel */}
            {panelOpen && <ControlPanel params={params} onChange={setParams} />}

            {/* Center: Display + Input */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Toggle panel button */}
              <div className="flex items-center px-3 py-1.5 border-b border-[#1e293b]/50">
                <button onClick={() => setPanelOpen(!panelOpen)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {panelOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
                  {panelOpen ? "收起面板" : "展开面板"}
                </button>
              </div>

              {/* Image display area */}
              <ImageDisplay images={images} isGenerating={isGenerating} generatingCount={params.count}
                onRegenerate={handleGenerate} onEdit={(image) => setParams(prev => ({ ...prev, referenceImage: image.url }))} />

              {/* Prompt input */}
              <PromptInput params={params} onGenerate={handleGenerate} isGenerating={isGenerating} />
            </div>

            {/* Right: History */}
            <GenerationHistory history={history}
              onSelect={(image) => setImages([image])}
              onClear={() => { setHistory([]); clearHistory(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DesignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f14] flex items-center justify-center"><div className="text-[#64748b]">加载中...</div></div>}>
      <DesignPageInner />
    </Suspense>
  );
}
