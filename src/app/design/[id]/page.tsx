'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Palette, Send, Loader2, Bot, User, Image,
  Type, Shapes, Upload, Layers, Wand2, Download,
  Maximize2, Minimize2, MessageSquare, Code2, Sparkles,
  Presentation, Layout, Video
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  const initialPrompt = searchParams.get('prompt') || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState('templates');
  const [canvasHtml, setCanvasHtml] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load design config (tools + suggestions)
  useEffect(() => {
    fetch('/api/design/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setTools(data.tools || []);
          setSuggestions(data.suggestions || []);
        }
      })
      .catch(() => {});
  }, []);

  // Send initial prompt if provided
  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  // Load existing conversation
  useEffect(() => {
    if (id && id !== 'new') {
      setConversationId(id);
      fetch(`/api/design/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.data?.messages) {
            setMessages(data.data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.createdAt),
            })));
          }
        })
        .catch(() => {});
    }
  }, [id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (text?: string) => {
    const userMessage = text || input.trim();
    if (!userMessage || isLoading) return;

    const msgId = `msg-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: msgId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/design/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId }),
      });

      if (!res.ok) throw new Error('Request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = `msg-${Date.now()}-assistant`;

      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.slice(2));
                assistantContent += text;
                setMessages(prev => prev.map(m => 
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                ));
              } catch {}
            }
          }
        }
      }

      // Check for HTML preview in response
      const htmlMatch = assistantContent.match(/<!--HTML_PREVIEW\n([\s\S]*?)\n-->/);
      if (htmlMatch) {
        const meta = htmlMatch[1];
        const htmlM = meta.match(/html:(.*)/);
        if (htmlM) {
          try {
            const html = decodeURIComponent(escape(atob(htmlM[1].trim())));
            setCanvasHtml(html);
          } catch {
            try { setCanvasHtml(atob(htmlM[1].trim())); } catch {}
          }
        }
      }

      const convIdHeader = res.headers.get('X-Conversation-Id');
      if (convIdHeader) setConversationId(convIdHeader);

    } catch (e) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: '❌ 生成失败，请重试',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`h-screen bg-[#0f0f14] text-[#f1f5f9] flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
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
        <div className="flex items-center gap-1">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg hover:bg-[#1e1e2a] transition-colors" title="全屏">
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#94a3b8]" /> : <Maximize2 className="w-4 h-4 text-[#94a3b8]" />}
          </button>
          <button className="p-1.5 rounded-lg hover:bg-[#1e1e2a] transition-colors" title="下载">
            <Download className="w-4 h-4 text-[#94a3b8]" />
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tools Panel - from API */}
        <div className="w-14 md:w-16 border-r border-[#1e293b] bg-[#16161e] flex flex-col items-center py-2 gap-1 shrink-0">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`w-10 md:w-12 h-10 md:h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                activeTool === tool.id
                  ? 'bg-[#7c3aed]/20 text-[#a78bfa]'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e1e2a]'
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
            {canvasHtml ? (
              <div className="w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={canvasHtml}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none"
                  title="Design Canvas"
                />
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#1e1e2a] flex items-center justify-center">
                  <Wand2 className="w-10 h-10 text-[#7c3aed]/30" />
                </div>
                <h3 className="text-lg font-medium text-[#94a3b8] mb-2">AI 设计画布</h3>
                <p className="text-sm text-[#64748b] max-w-xs mx-auto">在右侧对话框描述你的设计需求，AI 将为你生成设计稿并展示在这里</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Chat Panel */}
        <div className="w-72 md:w-80 border-l border-[#1e293b] bg-[#16161e] flex flex-col shrink-0">
          {/* Chat Header */}
          <div className="px-3 py-2 border-b border-[#1e293b] flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">AI 设计助手</span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <SparkleIcon />
                <p className="text-xs text-[#64748b] mt-3">描述你想设计的内容</p>
                {/* Suggestions from API */}
                <div className="mt-3 space-y-1.5">
                  {suggestions.map((s, i) => (
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
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-[#1e1e2a] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-[#a78bfa]" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-[#1e1e2a] text-[#cbd5e1]'
                }`}>
                  <div className="whitespace-pre-wrap break-words">{msg.content.replace(/<!--[\s\S]*?-->/g, '').trim()}</div>
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
            <div className="flex items-center gap-2 bg-[#1e1e2a] rounded-xl px-3 py-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述设计需求..."
                className="flex-1 bg-transparent outline-none text-sm text-[#f1f5f9] placeholder-[#64748b]"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="p-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 transition-colors"
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
