'use client';

import { useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { AiChat } from './AiChat';
import { Terminal } from './Terminal';
import type { WorkspaceFile, WorkspaceMessage } from '@/types';

interface WorkspaceLayoutProps {
  projectId: string;
}

export function WorkspaceLayout({ projectId }: WorkspaceLayoutProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);

  const handleFileCreate = async (name: string, type: 'file' | 'folder', parentId?: string) => {
    const response = await fetch('/api/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name, type, parentId }),
    });
    if (response.ok) {
      const newFile = await response.json();
      setFiles(prev => [...prev, newFile]);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    const response = await fetch(`/api/workspace/files?id=${fileId}`, {
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
    const response = await fetch('/api/workspace/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fileId, content }),
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

  const handleSendMessage = async (content: string, attachments?: string[]) => {
    const userMessage: WorkspaceMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      attachments,
      projectId,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/workspace/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          files,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: WorkspaceMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        projectId,
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
      console.error('Chat error:', error);
    }
  };

  const handleTerminalCommand = async (command: string) => {
    setTerminalOutput(prev => [...prev, `$ ${command}`]);

    try {
      const response = await fetch('/api/workspace/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, command }),
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
      <Group direction="vertical" className="flex-1">
        <Panel defaultSize={showTerminal ? 75 : 100} minSize={50}>
          <Group direction="horizontal" className="h-full">
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
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {files.length} 个文件
        </span>
      </div>
    </div>
  );
}
