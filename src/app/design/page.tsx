'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Palette, Plus, Search, Sparkles, Layout, Image, Type, 
  FileImage, Video, Presentation, ArrowRight, Clock,
  MessageSquare, Code2, Shapes, Upload, Layers
} from 'lucide-react';

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

// Icon mapping - maps string icon names to components
const ICON_MAP: Record<string, any> = {
  Sparkles, Image, Type, Presentation, Layout, Video, Shapes, Upload, Layers,
};

function CategoryIcon({ name }: { name: string }) {
  const IconComp = ICON_MAP[name] || Sparkles;
  return <IconComp className="w-4 h-4" />;
}

export default function DesignPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  // Load design config from API
  useEffect(() => {
    fetch('/api/design/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCategories(data.categories || []);
          setTemplates(data.templates || []);
        }
        setConfigLoading(false);
      })
      .catch(() => setConfigLoading(false));
  }, []);

  // Load recent design projects
  useEffect(() => {
    fetch('/api/design')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setProjects(Array.isArray(data.data) ? data.data : []))
      .catch(() => {});
  }, []);

  const handleCreate = async (prompt?: string) => {
    const userPrompt = prompt || input.trim();
    if (!userPrompt) return;
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: userPrompt.slice(0, 50), prompt: userPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/design/${data.data?.id || 'new'}?prompt=${encodeURIComponent(userPrompt)}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTemplates = activeCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category_id === activeCategory);

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

      <main className="max-w-4xl mx-auto px-4">
        {/* Hero - Input Area */}
        <div className="py-16 md:py-24 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#7c3aed] bg-clip-text text-transparent">
            AI 设计工坊
          </h1>
          <p className="text-[#94a3b8] mb-8 text-sm md:text-base">描述你的设计需求，AI 为你生成专业设计稿</p>
          
          {/* Central Input */}
          <div className="max-w-2xl mx-auto relative">
            <div className="flex items-center bg-[#16161e] border border-[#1e293b] rounded-2xl px-4 py-3 focus-within:border-[#7c3aed]/50 focus-within:shadow-lg focus-within:shadow-[#7c3aed]/10 transition-all">
              <Sparkles className="w-5 h-5 text-[#7c3aed] mr-3 shrink-0" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="描述你想设计的内容，如：一张科技感海报..."
                className="flex-1 bg-transparent outline-none text-[#f1f5f9] placeholder-[#64748b] text-sm md:text-base"
              />
              <button
                onClick={() => handleCreate()}
                disabled={!input.trim() || isCreating}
                className="ml-3 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
              >
                {isCreating ? '生成中...' : '开始设计'}
                {!isCreating && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Category Tags - loaded from API */}
        {!configLoading && categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20'
                    : 'bg-[#16161e] text-[#94a3b8] border border-[#1e293b] hover:border-[#7c3aed]/30 hover:text-[#a78bfa]'
                }`}
              >
                <CategoryIcon name={cat.icon} />
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Template Grid - loaded from API */}
        {!configLoading && filteredTemplates.length > 0 && (
          <div className="py-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-[#a78bfa]" />
              快速开始
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleCreate(template.prompt)}
                  className="group relative bg-[#16161e] border border-[#1e293b] hover:border-[#7c3aed]/40 rounded-xl p-4 text-left transition-all hover:shadow-lg hover:shadow-[#7c3aed]/5 hover:-translate-y-0.5"
                >
                  {/* Placeholder thumbnail */}
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
              <Clock className="w-5 h-5 text-[#a78bfa]" />
              最近项目
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map(project => (
                <Link
                  key={project.id}
                  href={`/design/${project.id}`}
                  className="group bg-[#16161e] border border-[#1e293b] hover:border-[#7c3aed]/40 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-[#7c3aed]/5"
                >
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
    </div>
  );
}
