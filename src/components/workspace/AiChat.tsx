'use client';
import { toast } from 'sonner';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Image, FileText, Code, Wrench, CheckCircle, XCircle, Loader2, MessageSquare, Brain, CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import type { WorkspaceFile, Attachment } from '@/types';
import { ToolCallDisplay } from '@/components/chat/tool-call-display';

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
    callId: string;
    toolName: string;
    status: 'running' | 'done' | 'error';
    summary?: string;
  }>;
}

interface ToolCall {
  callId: string;
  toolName: string;
  status: 'running' | 'done' | 'error';
  summary?: string;
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

// Tool name Chinese mapping
const TOOL_NAME_ZH: Record<string, string> = {
  createFile: "创建文件",
  editFile: "修改文件",
  deleteFile: "删除文件",
  runCommand: "执行命令",
  deploy: "部署项目",
  readFile: "读取文件",
};

// Chinese tool name mapping for history parsing (Chinese -> English for display compatibility)
const TOOL_NAME_CN: Record<string, string> = {
  '创建文件': 'createFile',
  '修改文件': 'editFile',
  '删除文件': 'deleteFile',
  '执行命令': 'runCommand',
  '部署项目': 'deploy',
  '读取文件': 'readFile',
  '联网搜索': 'searchWeb',
  '保存记忆': 'saveMemory',
};

// Helper function to generate tool args summary
function getToolArgsSummary(toolName: string, args: any): string {
  if (!args) return '';
  if (args.path) return args.path;
  if (args.command) return args.command.length > 50 ? args.command.slice(0, 50) + '...' : args.command;
  if (args.query) return args.query;
  return '';
}

export function AiChat({ projectId, modelId, files, onFilesChanged }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<{ content: string; assistantId: string } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            setMessages(data.map((m: any) => {
              let content = m.content;
              let toolCalls: ChatMessage['toolCalls'] = undefined;
              
              // 解析 EXEC_LOG 标记，恢复工具调用信息
              if (m.role === 'assistant' && content.includes('<!--EXEC_LOG')) {
                const logMatch = content.match(/<!--EXEC_LOG\n([\s\S]*?)\n-->/);
                if (logMatch) {
                  const logContent = logMatch[1];
                  toolCalls = [];
                  const lines = logContent.split('\n');
                  for (const line of lines) {
                    const match = line.match(/^\d+\.\s+(.+?):\s+(✅|❌)\s*(.*)/);
                    if (match) {
                      const cnName = match[1];
                      const status = match[2] === '✅' ? 'done' : 'error';
                      const summary = match[3];
                      toolCalls.push({
                        callId: 'hist-' + toolCalls.length,
                        toolName: cnName, // 存储中文名
                        status,
                        summary,
                      });
                    }
                  }
                  // 从 content 中移除 EXEC_LOG 部分，避免重复显示
                  content = content.replace(/\n\n<!--EXEC_LOG\n[\s\S]*?\n-->/, '');
                }
              }
              
              return {
                id: m.id,
                role: m.role,
                content,
                toolCalls,
              };
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    loadHistory();
  }, [projectId]);

  // Flush timer for streaming
  const startFlushTimer = useCallback((assistantId: string) => {
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = setInterval(() => {
      if (streamingRef.current) {
        const { content } = streamingRef.current;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content } : m));
      }
    }, 50);
  }, []);

  const stopFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (streamingRef.current) {
      const { content, assistantId } = streamingRef.current;
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content } : m));
      streamingRef.current = null;
    }
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.warning('文件 "' + file.name + '" 超过 5MB 限制');
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
        toast.error('无法读取文件 "' + file.name + '"');
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
    setIsThinking(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
    };
    setMessages(prev => [...prev, assistantMessage]);

    streamingRef.current = { content: '', assistantId };
    startFlushTimer(assistantId);

    const allMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch('/api/workspace/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          modelId,
          projectId,
          conversationId: projectId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      const toolCalls: ChatMessage['toolCalls'] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const sseEvent of events) {
          const dataLine = sseEvent.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(6);
          if (!jsonStr.trim()) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case 'content':
                setIsThinking(false);
                if (streamingRef.current) {
                  streamingRef.current.content += event.content || '';
                }
                break;

              case 'tool-start':
                setIsThinking(false);
                toolCalls.push({
                  callId: event.callId || '',
                  toolName: event.toolName || '',
                  status: 'running',
                  summary: getToolArgsSummary(event.toolName, event.args),
                });
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m
                ));
                break;

              case 'tool-result':
                const idx = toolCalls.findIndex(tc => tc.callId === event.callId);
                if (idx >= 0) {
                  toolCalls[idx] = {
                    ...toolCalls[idx],
                    status: event.success ? 'done' : 'error',
                    summary: event.summary,
                  };
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m
                  ));
                }
                break;

              case 'error':
                if (streamingRef.current) {
                  streamingRef.current.content += `❌ ${event.error}`;
                }
                break;
            }
          } catch {}
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      if (streamingRef.current) {
        streamingRef.current.content += `❌ ${errMsg}`;
      }
    } finally {
      stopFlushTimer();
      setIsLoading(false);
      setIsThinking(false);
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
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Paperclip className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium text-primary">释放以上传文件</p>
          </div>
        </div>
      )}

      <div className="h-10 flex items-center px-4 border-b border-border">
        <span className="text-sm font-medium">AI 编程助手</span>
        {isThinking && (
          <span className="ml-2 flex items-center gap-1 text-xs text-accent">
            <Brain className="w-3 h-3 animate-pulse" />
            思考中...
          </span>
        )}
        {isLoading && !isThinking && (
          <span className="ml-2 flex items-center gap-1 text-xs text-accent">
            <Loader2 className="w-3 h-3 animate-spin" />
            工作中...
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <div className="text-4xl mb-4">🤖</div>
            <p>告诉我你想做什么</p>
            <p className="text-xs mt-2">AI 可以帮你创建文件、修改代码、执行命令</p>
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
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mb-2">
                    <ToolCallDisplay toolCalls={message.toolCalls} />
                  </div>
                )}

                {message.content && (
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {attachments.length > 0 && (
        <div className="border-t border-border p-2 flex gap-2 flex-wrap">
          {attachments.map(att => (
            <div key={att.id} className="group relative flex items-center gap-2 bg-muted rounded-lg px-2 py-1.5 text-xs">
              {att.type === 'image' ? (
                <img src={att.url} alt={att.name} className="w-6 h-6 rounded object-cover" />
              ) : (
                <FileText className="w-3 h-3" />
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
            disabled={isLoading || !input.trim()}
            className="p-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
