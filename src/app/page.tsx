'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import Link from 'next/link';
import { Code2, MessageSquare, Palette, FolderOpen, Image, X, File, Folder, ChevronRight, ChevronDown, Plus, Menu } from 'lucide-react';

interface ProjectFile {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: ProjectFile[];
}

function ProjectPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [projects, setProjects] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load projects on first open
  if (isOpen && !loaded) {
    setLoaded(true);
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(Array.isArray(data) ? data : (data.data || []));
      })
      .catch(() => {});
  }

  const loadFiles = async (projectId: string) => {
    setSelectedProject(projectId);
    try {
      const res = await fetch(`/api/workspace/files?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(Array.isArray(data) ? data : []);
      }
    } catch {
      setFiles([]);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'sql', 'sh'];
    if (codeExts.includes(ext)) return <File className="w-3.5 h-3.5 text-green-400" />;
    return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <div className={`h-full flex flex-col border-l border-border bg-card transition-all duration-200 overflow-hidden
        ${isOpen ? 'w-72 min-w-[18rem]' : 'w-0 min-w-0'}
        ${isOpen ? 'max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:w-[85vw] max-md:min-w-0 max-md:animate-slide-in-right' : 'max-md:hidden'}
      `}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium truncate">项目文件</span>
          <div className="flex items-center gap-1">
            <Link href="/workspace" onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors" title="新建项目">
              <Plus className="w-4 h-4 text-primary" />
            </Link>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {!selectedProject ? (
            <div className="space-y-1">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadFiles(p.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    {p.description && <div className="text-xs text-muted-foreground truncate">{p.description}</div>}
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <p>暂无项目</p>
                  <Link href="/workspace" className="text-primary hover:underline mt-1 inline-block">去创建项目</Link>
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                onClick={() => { setSelectedProject(null); setFiles([]); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline mb-2 px-1"
              >
                ← 返回项目列表
              </button>
              <div className="space-y-0.5">
                {files.map(f => (
                  <div key={f.id}>
                    <div
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => f.type === 'folder' ? toggleFolder(f.path) : undefined}
                    >
                      {f.type === 'folder' ? (
                        <>
                          {expandedFolders.has(f.path) ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                          <Folder className="w-3.5 h-3.5 text-yellow-400" />
                        </>
                      ) : (
                        <>
                          <span className="w-3" />
                          {getFileIcon(f.name)}
                        </>
                      )}
                      <span className="text-xs truncate">{f.name}</span>
                    </div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">暂无文件</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function HomePage() {
  const [showPanel, setShowPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-3 py-3 md:px-4 border-b border-border bg-card safe-area-pt">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-base md:text-lg font-semibold truncate">AI 编程平台</h1>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/design" className="flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
            <Palette className="w-4 h-4 shrink-0" />
            <span>设计工坊</span>
          </Link>
          <Link href="/design?mode=quick" className="flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
            <Palette className="w-4 h-4 shrink-0" />
            <span>图片生成</span>
          </Link>
          <Link href="/workspace" className="flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Code2 className="w-4 h-4 shrink-0" />
            <span>编程工作区</span>
          </Link>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md transition-colors ${showPanel ? 'bg-accent text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="项目文件"
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>项目</span>
          </button>
        </nav>

        {/* Mobile: icon-only nav + menu button */}
        <div className="flex md:hidden items-center gap-0.5">
          <Link href="/design" className="p-2 rounded-lg hover:bg-muted transition-colors" title="设计工坊">
            <Palette className="w-5 h-5 text-muted-foreground" />
          </Link>
          <Link href="/design?mode=quick" className="p-2 rounded-lg hover:bg-muted transition-colors" title="图片生成">
            <Image className="w-5 h-5 text-muted-foreground" />
          </Link>
          <Link href="/workspace" className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" title="编程工作区">
            <Code2 className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className={`p-2 rounded-lg transition-colors ${showPanel ? 'bg-accent text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="项目文件"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0">
          <ChatInterface />
        </div>
        <ProjectPanel isOpen={showPanel} onClose={() => setShowPanel(false)} />
      </main>
    </div>
  );
}
