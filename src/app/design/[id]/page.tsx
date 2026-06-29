"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Palette, Send, Loader2, Bot, User, Image,
  Type, Shapes, Upload, Layers, Wand2, Download,
  Maximize2, Minimize2, MessageSquare, Code2, Sparkles,
  Presentation, Layout, Video, ImageIcon, X, Settings2,
  ChevronDown, Globe, Box, ArrowUp
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: Date;
}

interface ToolItem {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface SuggestionItem {
  id: string;
  text: string;
  sort_order: number;
}

interface ModelOption {
  modelId: string;
  name: string;
  provider: string;
}

const ICON_MAP: Record<string, any> = {
  Sparkles, Image, Type, Presentation, Layout, Video, Shapes, Upload, Layers,
};

function ToolIcon({ name }: { name: string }) {
  const IconComp = ICON_MAP[name] || Shapes;
  return <IconComp className="w-4 h-4" />;
}

export default function DesignEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const initialPrompt = searchParams.get("prompt") || "";
  const hasRef = searchParams.get("hasRef") === "1";
  const presetModel = searchParams.get("model") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState("templates");
  const [canvasHtml, setCanvasHtml] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<"html" | "image">("html");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState(presetModel || "auto");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState("");
  const [showUploadArea, setShowUploadArea] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config + models
  useEffect(() => {
    fetch("/api/design/config")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setTools(data.tools || []);
          setSuggestions(data.suggestions || []);
        }
      })
      .catch(() => {});

    fetch("/api/models")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.models) {
          setModels(data.models.map((m: any) => ({
            modelId: m.modelId || m.id,
            name: m.name || m.modelId,
            provider: m.provider,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Send initial prompt
  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReferenceImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    if (activeCanvas === 'html' && canvasHtml) {
      const blob = new Blob([canvasHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'design.html';
      a.click();
      URL.revokeObjectURL(url);
    } else if (activeCanvas === 'image' && generatedImages.length > 0) {
      generatedImages.forEach((url, i) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `design-${i + 1}.png`;
        a.click();
      });
    }
  };

  const sendMessage = async (text?: string) => {
    const userMessage = text || input.trim();
    if (!userMessage || isLoading) return;

    const msgId = `msg-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: msgId,
      role: "user",
      content: userMessage,
      images: referenceImage ? [referenceImage] : undefined,
      timestamp: new Date(),
    }]);
    setInput("");
    setIsLoading(true);

    // Capture ref image before clearing
    const currentRefImage = referenceImage;
    setReferenceImage(null);
    setReferenceFileName("");

    try {
      const res = await fetch("/api/design/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          referenceImage: currentRefImage,
          model: selectedModel !== "auto" ? selectedModel : undefined,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      // Parse AI SDK UI stream format
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantImages: string[] = [];
      const assistantId = `msg-${Date.now()}-assistant`;

      setMessages(prev => [...prev, {
        id: assistantId,
        role: "assistant",
        content: "",
        images: [],
        timestamp: new Date(),
      }]);

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          
          // Parse stream parts separated by newlines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // AI SDK UI stream format: 0:"text" for text deltas
            if (trimmed.startsWith("0:")) {
              try {
                const text = JSON.parse(trimmed.slice(2));
                assistantContent += text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                ));
              } catch {}
            }
            
            // Tool call results: b:{...}
            if (trimmed.startsWith("b:")) {
              try {
                const toolData = JSON.parse(trimmed.slice(2));
                const resultStr = typeof toolData.result === "string"
                  ? toolData.result
                  : JSON.stringify(toolData.result || "");
                
                // Extract HTML preview
                const htmlMatch = resultStr.match(/<!--HTML_PREVIEW\n([\s\S]*?)\n-->/);
                if (htmlMatch) {
                  const meta = htmlMatch[1];
                  const htmlM = meta.match(/html:(.*)/);
                  if (htmlM) {
                    try {
                      const html = decodeURIComponent(escape(atob(htmlM[1].trim())));
                      setCanvasHtml(html);
                      setActiveCanvas("html");
                    } catch {
                      try { setCanvasHtml(atob(htmlM[1].trim())); setActiveCanvas("html"); } catch {}
                    }
                  }
                }
                
                // Extract generated image
                const imgMatch = resultStr.match(/IMAGE_GENERATED:(\/generated\/[^\s]+)/);
                if (imgMatch) {
                  const imgUrl = imgMatch[1];
                  assistantImages.push(imgUrl);
                  setGeneratedImages(prev => [...new Set([...prev, imgUrl])]);
                  setActiveCanvas("image");
                }
              } catch {}
            }
            
            // Data parts (custom image_generated events)
            if (trimmed.startsWith("2:")) {
              try {
                const dataArr = JSON.parse(trimmed.slice(2));
                if (Array.isArray(dataArr)) {
                  for (const d of dataArr) {
                    if (d.type === "image_generated" && d.url) {
                      assistantImages.push(d.url);
                      setGeneratedImages(prev => [...new Set([...prev, d.url])]);
                      setActiveCanvas("image");
                    }
                  }
                }
              } catch {}
            }
          }
        }
      }

      // Also check content for [IMAGE:...] and IMAGE_GENERATED: patterns
      const imgTagMatches = assistantContent.match(/\[IMAGE:(\/generated\/[^\]]+)\]/g);
      if (imgTagMatches) {
        const urls = imgTagMatches.map(m => {
          const match = m.match(/\[IMAGE:(.+?)\]/);
          return match ? match[1] : "";
        }).filter(Boolean);
        for (const url of urls) {
          assistantImages.push(url);
        }
        setGeneratedImages(prev => [...new Set([...prev, ...urls])]);
        if (urls.length > 0) setActiveCanvas("image");
      }

      // Update final message with images
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: assistantContent, images: assistantImages } : m
      ));

      // Also check HTML preview from content
      const htmlMatch2 = assistantContent.match(/<!--HTML_PREVIEW\n([\s\S]*?)\n-->/);
      if (htmlMatch2) {
        const meta = htmlMatch2[1];
        const htmlM = meta.match(/html:(.*)/);
        if (htmlM) {
          try {
            const html = decodeURIComponent(escape(atob(htmlM[1].trim())));
            setCanvasHtml(html);
            setActiveCanvas("html");
          } catch {
            try { setCanvasHtml(atob(htmlM[1].trim())); setActiveCanvas("html"); } catch {}
          }
        }
      }

      const convIdHeader = res.headers.get("X-Conversation-Id");
      if (convIdHeader) setConversationId(convIdHeader);

    } catch (e) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: "生成失败，请重试",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`h-screen dark bg-[#0f0f14] text-[#f1f5f9] flex flex-col ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] bg-[#16161e] shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/design" className="p-1.5 rounded-lg hover:bg-[#1e1e2a] transition-colors">
            <ArrowLeft className="w-4 h-4 text-[#94a3b8]" />
          </Link>
          <div className="flex items-center gap-1.5 text-[#a78bfa]">
            <Palette className="w-4 h-4" />
            <span className="text-sm font-medium">设计编辑器</span>
          </div>
        </div>
        
        {/* Canvas switcher */}
        {(canvasHtml || generatedImages.length > 0) && (
          <div className="flex items-center gap-1 bg-[#1e1e2a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveCanvas("html")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeCanvas === "html" ? "bg-[#7c3aed] text-white" : "text-[#64748b] hover:text-[#94a3b8]"
              }`}
            >
              <Code2 className="w-3 h-3 inline mr-1" />HTML
            </button>
            {generatedImages.length > 0 && (
              <button
                onClick={() => setActiveCanvas("image")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  activeCanvas === "image" ? "bg-[#7c3aed] text-white" : "text-[#64748b] hover:text-[#94a3b8]"
                }`}
              >
                <ImageIcon className="w-3 h-3 inline mr-1" />图片({generatedImages.length})
              </button>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-1">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg hover:bg-[#1e1e2a] transition-colors" title="全屏">
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#94a3b8]" /> : <Maximize2 className="w-4 h-4 text-[#94a3b8]" />}
          </button>
          <button onClick={handleDownload} className="p-1.5 rounded-lg hover:bg-[#1e1e2a] transition-colors" title="下载">
            <Download className="w-4 h-4 text-[#94a3b8]" />
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tools Panel */}
        <div className="w-14 md:w-16 border-r border-[#1e293b] bg-[#16161e] flex flex-col items-center py-2 gap-1 shrink-0">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                if (tool.id === "upload") {
                  fileInputRef.current?.click();
                  return;
                }
                const toolPrompts: Record<string, string> = {
                  templates: "请展示可用的设计模板样式",
                  elements: "帮我添加一些设计元素和装饰",
                  text: "帮我优化设计中的文字排版和字体",
                  images: "生成一张设计配图",
                  layers: "帮我调整设计的图层和布局",
                };
                const prompt = toolPrompts[tool.id];
                if (prompt && !isLoading) sendMessage(prompt);
              }}
              className={`w-10 md:w-12 h-10 md:h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                activeTool === tool.id
                  ? "bg-[#7c3aed]/20 text-[#a78bfa]"
                  : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e1e2a]"
              }`}
              title={tool.name}
            >
              <ToolIcon name={tool.icon} />
              <span className="text-[9px]">{tool.name}</span>
            </button>
          ))}
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1a1a2e]">
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {activeCanvas === "html" && canvasHtml ? (
              <div className="w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={canvasHtml}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none"
                  title="Design Canvas"
                />
              </div>
            ) : activeCanvas === "image" && generatedImages.length > 0 ? (
              <div className="w-full max-w-4xl space-y-4">
                {generatedImages.map((url, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-2xl overflow-hidden">
                    <img src={url} alt={`Generated design ${i + 1}`} className="w-full h-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#1e1e2a] flex items-center justify-center">
                  <Wand2 className="w-10 h-10 text-[#7c3aed]/30" />
                </div>
                <h3 className="text-lg font-medium text-[#94a3b8] mb-2">AI 设计画布</h3>
                <p className="text-sm text-[#64748b] max-w-xs mx-auto">
                  在右侧对话框描述你的设计需求，或上传参考图进行图生图
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Chat Panel */}
        <div className="w-72 md:w-80 border-l border-[#1e293b] bg-[#16161e] flex flex-col shrink-0">
          {/* Chat Header */}
          <div className="px-3 py-2 border-b border-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium">AI 设计助手</span>
            </div>
            
            {/* Model picker in editor */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1 px-2 py-1 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-md text-[10px] text-[#64748b] transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                {selectedModel === "auto" ? "自动" : (models.find(m => m.modelId === selectedModel)?.name?.slice(0, 8) || selectedModel.slice(0, 8))}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1e1e2a] border border-[#2e2e3a] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedModel("auto"); setShowModelPicker(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                        selectedModel === "auto" ? "bg-[#7c3aed]/20 text-[#a78bfa]" : "text-[#94a3b8] hover:bg-[#2a2a3a]"
                      }`}
                    >
                      自动选择
                    </button>
                    {models.map(m => (
                      <button
                        key={m.modelId}
                        onClick={() => { setSelectedModel(m.modelId); setShowModelPicker(false); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                          selectedModel === m.modelId ? "bg-[#7c3aed]/20 text-[#a78bfa]" : "text-[#94a3b8] hover:bg-[#2a2a3a]"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <SparkleIcon />
                <p className="text-xs text-[#64748b] mt-3">描述你想设计的内容，或上传参考图</p>
                <div className="mt-3 space-y-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => sendMessage(s.text)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#94a3b8] hover:text-[#a78bfa] transition-colors"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-[#1e1e2a] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-[#a78bfa]" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-[#7c3aed] text-white"
                    : "bg-[#1e1e2a] text-[#cbd5e1]"
                }`}>
                  {/* User reference image */}
                  {msg.role === "user" && msg.images && msg.images.map((img, i) => (
                    <img key={i} src={img} alt="Reference" className="w-full rounded-lg mb-1.5" />
                  ))}
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content
                      .replace(/<!--[\s\S]*?-->/g, "")
                      .replace(/\[IMAGE:[^\]]+\]/g, "")
                      .trim()}
                  </div>
                  {/* Generated images inline */}
                  {msg.role === "assistant" && msg.images && msg.images.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 gap-1.5">
                      {msg.images.map((url, i) => (
                        <img key={i} src={url} alt="Generated" className="w-full rounded-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setActiveCanvas("image"); }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#1e1e2a] flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-[#a78bfa]" />
                </div>
                <div className="bg-[#1e1e2a] rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 text-[#a78bfa] animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-[#1e293b]">
            {/* Reference image preview in input */}
            {referenceImage && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative group">
                  <img src={referenceImage} alt="Ref" className="h-12 rounded-lg object-cover" />
                  <button
                    onClick={() => { setReferenceImage(null); setReferenceFileName(""); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
                <span className="text-[10px] text-[#64748b] truncate max-w-[80px]">{referenceFileName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-[#1e1e2a] rounded-xl px-3 py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-lg hover:bg-[#2a2a3a] text-[#64748b] hover:text-[#94a3b8] transition-colors shrink-0"
                title="上传参考图"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述设计需求或上传参考图..."
                className="flex-1 bg-transparent outline-none text-sm text-[#f1f5f9] placeholder-[#64748b]"
              />
              <button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !referenceImage) || isLoading}
                className="p-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#7c3aed]/20 to-[#7c3aed]/5 flex items-center justify-center">
      <Wand2 className="w-6 h-6 text-[#7c3aed]" />
    </div>
  );
}
