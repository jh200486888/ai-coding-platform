'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Image, FileText, Code, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AiMessageRenderer } from './AiMessageRenderer';
import type { WorkspaceFile, Attachment } from '@/types';

interface AiChatProps {
  projectId: string;
  modelId: string;
  files: WorkspaceFile[];
  onFilesChanged?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    state: 'running' | 'result' | 'error';
    result?: any;
  }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function classifyFile(file: File): Attachment['type'] {
  if (file.type.startsWith('image/')) return 'image';
  const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.css', '.html', '.json', '.yaml', '.yml', '.toml', '.sql', '.sh', '.bash', '.zsh'];
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (codeExts.includes(ext)) return 'code';
  return 'document';
}

function AttachmentTypeIcon({ type }: { type: Attachment['type'] }) {
  switch (type) {
    case 'image': return <Image className="w-3 h-3" />;
    case 'code': return <Code className="w-3 h-3" />;
    default: return <FileText className="w-3 h-3" />;
  }
}

function ToolCallIndicator({ name, state }: { name: string; state: string }) {
  const isDone = state === 'result';
  const isError = state === 'error';

  const labelMap: Record<string, string> = {
    createFile: '创建文件',
    editFile: '修改文件',
    deleteFile: '删除文件',
    runCommand: '执行命令',
  };
  const label = labelMap[name] || name;

  return (
    <div className={'flex items-center gap-2 px-3 py-2 rounded-lg text-xs my-1 ' +
      (isError ? 'bg-red-500/10 text-red-400' :
      isDone ? 'bg-green-500/10 text-green-400' :
      'bg-accent/10 text-accent')
    }>
      {isError ? (
        <XCircle className="w-3.5 h-3.5" />
      ) : isDone ? (
        <CheckCircle className="w-3.5 h-3.5" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      )}
      <Wrench className="w-3 h-3" />
      <span className="font-medium">{label}</span>
      {!isDone && !isError && <span className="text-muted-foreground">执行中...</span>}
      {isDone && <span className="text-muted-foreground">完成</span>}
    </div>
  );
}

export function AiChat({ projectId, modelId, files, onFilesChanged }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/workspace/messages?conversationId=' + projectId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    loadHistory();
  }, [projectId]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        alert('文件 "' + file.name + '" 超过 5MB 限制');
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          name: file.name,
          type: classifyFile(file),
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          url: base64,
        });
      } catch {
        alert('无法读取文件 "' + file.name + '"');
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading) return;

    const userContent = input;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    // Build messages array for API
    const allMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Build files context
    const filesContext = files.reduce((acc, f) => {
      if (f.type === 'file' && f.content) acc[f.path] = f.content;
      return acc;
    }, {} as Record<string, string>);

    try {
      const response = await fetch('/api/workspace/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: projectId,
          modelId,
          messages: allMessages,
          files: filesContext,
          projectId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '请求失败');
      }

      // Parse AI SDK data stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无响应流');

      const decoder = new TextDecoder();
      let assistantContent = '';
      const toolCalls: ChatMessage['toolCalls'] = [];

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        toolCalls: [],
      };

      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          // Text delta: starts with "0:"
          if (line.startsWith('0:')) {
            try {
              const textDelta = JSON.parse(line.slice(2));
              if (typeof textDelta === 'string') {
                assistantContent += textDelta;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
            } catch {}
          }
          // Tool call: starts with "9:"
          else if (line.startsWith('9:')) {
            try {
              const toolCall = JSON.parse(line.slice(2));
              if (toolCall.toolCallId && toolCall.toolName) {
                const tc = {
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  state: 'running' as const,
                };
                toolCalls.push(tc);
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, toolCalls: [...toolCalls] }
                      : m
                  )
                );
              }
            } catch {}
          }
          // Tool result: starts with "a:"
          else if (line.startsWith('a:')) {
            try {
              const toolResult = JSON.parse(line.slice(2));
              if (toolResult.toolCallId) {
                const idx = toolCalls.findIndex(tc => tc.toolCallId === toolResult.toolCallId);
                if (idx >= 0) {
                  toolCalls[idx] = {
                    ...toolCalls[idx],
                    state: 'result',
                    result: toolResult.result,
                  };
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessage.id
                        ? { ...m, toolCalls: [...toolCalls] }
                        : m
                    )
                  );
                }
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '❌ ' + errMsg,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Refresh files after AI finishes
      onFilesChanged?.();
    }
  };

  return (
    <div
      className="h-full flex flex-col bg-card border-l border-border relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Paperclip className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium text-primary">释放以上传文件</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-10 flex items-center px-4 border-b border-border">
        <span className="text-sm font-medium">AI 编程助手</span>
        {isLoading && (
          <span className="ml-2 flex items-center gap-1 text-xs text-accent">
            <Loader2 className="w-3 h-3 animate-spin" />
            工作中...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <div className="text-4xl mb-4">🤖</div>
            <p>告诉我你想做什么</p>
            <p className="text-xs mt-2">AI 可以帮你创建文件、修改代码、执行命令</p>
            <p className="text-xs mt-1 text-muted-foreground/60">支持拖拽文件上传附件</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={'flex ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={'max-w-[90%] rounded-lg px-3 py-2 ' +
                  (message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')
                }
              >
                {/* Tool calls display */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {message.toolCalls.map(tc => (
                      <ToolCallIndicator
                        key={tc.toolCallId}
                        name={tc.toolName}
                        state={tc.state}
                      />
                    ))}
                  </div>
                )}

                {/* Message content */}
                {message.content && (
                  message.role === 'user' ? (
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <AiMessageRenderer content={message.content} />
                  )
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="border-t border-border p-2 flex gap-2 flex-wrap">
          {attachments.map(att => (
            <div key={att.id} className="group relative flex items-center gap-2 bg-muted rounded-lg px-2 py-1.5 text-xs">
              {att.type === 'image' ? (
                <img src={att.url} alt={att.name} className="w-6 h-6 rounded object-cover" />
              ) : (
                <AttachmentTypeIcon type={att.type} />
              )}
              <span className="max-w-[100px] truncate">{att.name}</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-2">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
            title="上传附件"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="告诉我你想做什么..."
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="p-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
