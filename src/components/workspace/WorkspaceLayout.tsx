'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
      .catch(() => {
        // fallback to empty
      });
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

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const handleFileCreate = async (name: string, type: 'file' | 'folder', parentId?: string) => {
    const path = name;
    const response = await fetch('/api/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, path, name, type, content: '' }),
    });
    if (response.ok) {
      fetchFiles();
    }
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
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, content } : f))
      );
    }
  };

  const handleFileSelect = (file: WorkspaceFile) => {
    if (file.type === 'file') setActiveFile(file);
  };

  const handleFilesChanged = () => {
    fetchFiles();
  };

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top toolbar: model selection */}
      <div className="h-10 shrink-0 border-b border-border bg-card flex items-center px-4 gap-3">
        <Link href="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft size={14} /> 首页</Link>
        <span className="text-sm text-muted-foreground ml-2">模型:</span>
        <select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1 text-sm"
        >
          {models.length === 0 && <option value="">未配置模型</option>}
          {models.map(m => (
            <option key={m.model_id} value={m.model_id}>{m.display_name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {files.filter(f => f.type === 'file').length} 个文件
        </span>
      </div>

      {/* Main content area - resizable panels */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          {/* File tree panel */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <FileTree
              files={files}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Code editor panel */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <CodeEditor
              file={activeFile}
              onChange={content => {
                if (activeFile) handleFileUpdate(activeFile.id, content);
              }}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* AI chat panel */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={55}>
            <AiChat
              projectId={projectId}
              modelId={selectedModelId}
              files={files}
              onFilesChanged={handleFilesChanged}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Terminal panel (conditional, vertically resizable) */}
      {showTerminal && (
        <ResizablePanelGroup orientation="vertical" className="h-[200px] shrink-0 border-t border-border">
          <ResizablePanel defaultSize={100} minSize={30}>
            <Terminal
              output={terminalOutput}
              onCommand={handleTerminalCommand}
              onClose={() => setShowTerminal(false)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
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
