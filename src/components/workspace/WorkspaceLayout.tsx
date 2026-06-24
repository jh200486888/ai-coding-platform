'use client';

import { useState, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { AiChat } from './AiChat';
import { Terminal } from './Terminal';
import { getAllModels } from '@/lib/models';
import type { WorkspaceFile } from '@/types';

interface WorkspaceLayoutProps {
  projectId: string;
}

export function WorkspaceLayout({ projectId }: WorkspaceLayoutProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('deepseek-v4-pro');

  const allModels = getAllModels();

  // Load project files
  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/workspace/files?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
        // Auto-select first file
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

  // Called when AI tool calls change files — refresh file list
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
    <div className="h-full flex flex-col">
      {/* Top toolbar: model selection */}
      <div className="h-10 border-b border-border bg-card flex items-center px-4 gap-3">
        <span className="text-sm text-muted-foreground">模型:</span>
        <select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1 text-sm"
        >
          {allModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {files.filter(f => f.type === 'file').length} 个文件
        </span>
      </div>

      <Group orientation="vertical" className="flex-1">
        <Panel defaultSize={showTerminal ? 75 : 100} minSize={50}>
          <Group orientation="horizontal" className="h-full">
            {/* File tree */}
            <Panel defaultSize={20} minSize={15} maxSize={35}>
              <FileTree
                files={files}
                activeFile={activeFile}
                onFileSelect={handleFileSelect}
                onFileCreate={handleFileCreate}
                onFileDelete={handleFileDelete}
              />
            </Panel>

            <Separator className="w-1 bg-border hover:bg-primary transition-colors" />

            {/* Code editor */}
            <Panel defaultSize={50} minSize={30}>
              <CodeEditor
                file={activeFile}
                onChange={content => {
                  if (activeFile) handleFileUpdate(activeFile.id, content);
                }}
              />
            </Panel>

            <Separator className="w-1 bg-border hover:bg-primary transition-colors" />

            {/* AI chat */}
            <Panel defaultSize={30} minSize={20} maxSize={50}>
              <AiChat
                projectId={projectId}
                modelId={selectedModelId}
                files={files}
                onFilesChanged={handleFilesChanged}
              />
            </Panel>
          </Group>
        </Panel>

        {showTerminal && (
          <>
            <Separator className="h-1 bg-border hover:bg-primary transition-colors" />
            <Panel defaultSize={25} minSize={15}>
              <Terminal
                output={terminalOutput}
                onCommand={handleTerminalCommand}
                onClose={() => setShowTerminal(false)}
              />
            </Panel>
          </>
        )}
      </Group>

      {/* Bottom toolbar */}
      <div className="h-10 border-t border-border bg-card flex items-center px-4 gap-4">
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
