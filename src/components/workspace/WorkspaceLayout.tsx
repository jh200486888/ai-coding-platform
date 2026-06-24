'use client';

import { useState, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { AiChat } from './AiChat';
import { Terminal } from './Terminal';
import { getAllModels } from '@/lib/models';
import type { WorkspaceFile, WorkspaceMessage, Attachment } from '@/types';

interface WorkspaceLayoutProps {
  projectId: string;
}

export function WorkspaceLayout({ projectId }: WorkspaceLayoutProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('deepseek-v4-pro');

  const allModels = getAllModels();

  // 加载项目文件
  useEffect(() => {
    fetchFiles();
    fetchMessages();
  }, [projectId]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/workspace/files?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
        // 自动选中第一个文件
        if (data.length > 0 && data.some((f: WorkspaceFile) => f.type === 'file')) {
          const firstFile = data.find((f: WorkspaceFile) => f.type === 'file');
          if (firstFile) setActiveFile(firstFile);
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/workspace/conversations?project_id=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const msgs = data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            conversationId: m.conversationId,
            createdAt: m.createdAt,
          }));
          setMessages(msgs);
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleFileCreate = async (name: string, type: 'file' | 'folder', parentId?: string) => {
    const path = name; // 简化：文件名即路径
    const response = await fetch('/api/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, path, name, type, content: '' }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.file) {
        setFiles(prev => [...prev, result.file]);
      }
      // 重新加载确保同步
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
      if (activeFile?.id === fileId) {
        setActiveFile(null);
      }
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
    if (file.type === 'file') {
      setActiveFile(file);
    }
  };

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    const userMessage: WorkspaceMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      attachments,
      conversationId: projectId,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/workspace/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: projectId,
          modelId: selectedModelId,
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          files: files.reduce((acc, f) => {
            if (f.type === 'file' && f.content) {
              acc[f.path] = f.content;
            }
            return acc;
          }, {} as Record<string, string>),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: WorkspaceMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        conversationId: projectId,
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantContent += chunk;

          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessage.id
                ? { ...m, content: assistantContent }
                : m
            )
          );
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      const errorMessage: WorkspaceMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `❌ ${errMsg}`,
        conversationId: projectId,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
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
    } catch (error) {
      setTerminalOutput(prev => [...prev, 'Error executing command']);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏：模型选择 */}
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
          {files.length} 个文件
        </span>
      </div>

      <Group orientation="vertical" className="flex-1">
        <Panel defaultSize={showTerminal ? 75 : 100} minSize={50}>
          <Group orientation="horizontal" className="h-full">
            {/* 文件树 */}
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

            {/* 代码编辑器 */}
            <Panel defaultSize={50} minSize={30}>
              <CodeEditor
                file={activeFile}
                onChange={content => {
                  if (activeFile) {
                    handleFileUpdate(activeFile.id, content);
                  }
                }}
              />
            </Panel>

            <Separator className="w-1 bg-border hover:bg-primary transition-colors" />

            {/* AI 对话 */}
            <Panel defaultSize={30} minSize={20} maxSize={50}>
              <AiChat
                messages={messages}
                onSendMessage={handleSendMessage}
                files={files}
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

      {/* 底部工具栏 */}
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
