'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { AiChat } from './AiChat';
import { Terminal } from './Terminal';
import type { WorkspaceFile } from '@/types';

interface WorkspaceLayoutProps {
  projectId: string;
}

interface DbModel {
  model_id: string;
  display_name: string;
  provider: string;
}

export function WorkspaceLayout({ projectId }: WorkspaceLayoutProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [models, setModels] = useState<DbModel[]>([]);
  const [mobileView, setMobileView] = useState<'chat' | 'files' | 'editor'>('chat');

  // Panel widths (px) - user can drag to resize
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Load models from database
  useEffect(() => {
    fetch('/api/workspace/models')
      .then(r => r.json())
      .then(data => {
        const list: DbModel[] = Array.isArray(data) ? data : (data.data || []);
        setModels(list);
        if (list.length > 0 && !selectedModelId) {
          setSelectedModelId(list[0].model_id);
        }
      })
      .catch(() => {});
  }, []);

  // Load project files
  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/workspace/files?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
        if (data.length > 0 && data.some((f: WorkspaceFile) => f.type === 'file')) {
          const firstFile = data.find((f: WorkspaceFile) => f.type === 'file');
          if (firstFile) setActiveFile(firstFile);
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  useEffect(() => { fetchFiles(); }, [projectId]);

  const handleFileCreate = async (name: string, type: 'file' | 'folder', parentId?: string) => {
    const path = name;
    const response = await fetch('/api/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, path, name, type, content: '' }),
    });
    if (response.ok) fetchFiles();
  };

  const handleFileDelete = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const response = await fetch(`/api/workspace/files?projectId=${projectId}&path=${encodeURIComponent(file.path)}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
      if (activeFile?.id === fileId) setActiveFile(null);
    }
  };

  const handleFileUpdate = async (fileId: string, content: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const response = await fetch('/api/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, path: file.path, content }),
    });
    if (response.ok) {
      setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, content } : f)));
    }
  };

  const handleFileSelect = (file: WorkspaceFile) => {
    if (file.type === 'file') setActiveFile(file);
  };

  const handleFilesChanged = () => { fetchFiles(); };

  const handleTerminalCommand = async (command: string) => {
    setTerminalOutput(prev => [...prev, `$ ${command}`]);
    try {
      const response = await fetch('/api/workspace/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: projectId, command }),
      });
      const data = await response.json();
      if (data.output) {
        setTerminalOutput(prev => [...prev, data.output]);
      }
    } catch {
      setTerminalOutput(prev => [...prev, 'Error executing command']);
    }
  };

  // Drag resize handlers
  const handleMouseDown = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = side;
    startXRef.current = e.clientX;
    startWidthRef.current = side === 'left' ? leftWidth : rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      if (draggingRef.current === 'left') {
        setLeftWidth(Math.max(200, Math.min(500, startWidthRef.current + dx)));
      } else {
        setRightWidth(Math.max(200, Math.min(600, startWidthRef.current - dx)));
      }
    };
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top toolbar: model selection */}
      <div className="h-10 shrink-0 border-b border-border bg-card flex items-center px-4 gap-3">
        <Link href="/admin" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-primary/10 px-2.5 py-1 rounded-md hover:bg-primary/20"><ArrowLeft size={14} /> 返回项目管理</Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-primary/10 px-2.5 py-1 rounded-md hover:bg-primary/20"><ArrowLeft size={14} /> 首页</Link>
        <span className="hidden sm:inline text-sm text-muted-foreground ml-2">模型:</span>
        <select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1 text-sm max-w-[120px] sm:max-w-none"
        >
          {models.length === 0 && <option value="">未配置模型</option>}
          {models.map(m => (
            <option key={m.model_id} value={m.model_id}>{m.display_name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="hidden sm:inline text-xs text-muted-foreground">
          {files.filter(f => f.type === 'file').length} 个文件
        </span>
      </div>

      {/* Mobile view switcher */}
      <div className="md:hidden flex items-center gap-1 px-2 py-1 border-b border-border bg-card">
        <button onClick={() => setMobileView('chat')} className={`flex-1 py-1.5 text-xs rounded ${mobileView === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
          对话
        </button>
        <button onClick={() => setMobileView('files')} className={`flex-1 py-1.5 text-xs rounded ${mobileView === 'files' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
          文件
        </button>
        <button onClick={() => setMobileView('editor')} className={`flex-1 py-1.5 text-xs rounded ${mobileView === 'editor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
          编辑器
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex" ref={containerRef}>
        {/* Left: File tree */}
        <div
          style={{ width: leftWidth, minWidth: 200 }}
          className={`shrink-0 h-full overflow-hidden ${mobileView !== 'files' ? 'hidden md:block' : ''}`}
        >
          <FileTree
            files={files}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
          />
        </div>

        {/* Left drag handle */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors items-center justify-center hidden md:flex"
          onMouseDown={handleMouseDown('left')}
        >
          <div className="w-0.5 h-8 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Center: Code editor */}
        <div className={`flex-1 min-w-[200px] h-full overflow-hidden ${mobileView !== 'editor' ? 'hidden md:block' : ''}`}>
          <CodeEditor
            file={activeFile}
            onChange={content => {
              if (activeFile) handleFileUpdate(activeFile.id, content);
            }}
          />
        </div>

        {/* Right drag handle */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors items-center justify-center hidden md:flex"
          onMouseDown={handleMouseDown('right')}
        >
          <div className="w-0.5 h-8 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Right: AI Chat */}
        <div
          style={{ width: rightWidth, minWidth: 200 }}
          className={`shrink-0 h-full overflow-hidden ${mobileView !== 'chat' ? 'hidden md:block' : ''}`}
        >
          <AiChat
            projectId={projectId}
            modelId={selectedModelId}
            files={files}
            onFilesChanged={handleFilesChanged}
          />
        </div>
      </div>

      {/* Terminal panel (conditional) */}
      {showTerminal && (
        <div className="h-[250px] shrink-0 border-t border-border">
          <Terminal
            output={terminalOutput}
            onCommand={handleTerminalCommand}
            onClose={() => setShowTerminal(false)}
          />
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="h-10 shrink-0 border-t border-border bg-card flex items-center px-4 gap-4">
        <button
          onClick={() => setShowTerminal(!showTerminal)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {showTerminal ? '隐藏终端' : '显示终端'}
        </button>
      </div>
    </div>
  );
}
