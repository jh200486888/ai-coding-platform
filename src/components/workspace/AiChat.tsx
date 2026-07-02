'use client';
import { toast } from 'sonner';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, FileText, Brain, Loader2 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import type { WorkspaceFile, Attachment, Message } from '@/types';
import { ToolCallDisplay } from '@/components/chat/tool-call-display';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useFileUpload } from '@/components/chat/hooks/use-file-upload';

interface AiChatProps {
  projectId: string;
  modelId: string;
  files: WorkspaceFile[];
  onFilesChanged?: () => void;
}

// Helper: extract plain text from UIMessage
function extractTextContent(msg: any): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('');
  }
  return '';
}

// Extract tool calls from UIMessage parts
function extractToolCallsFromMessage(msg: any): Array<{
  callId: string;
  toolName: string;
  status: 'running' | 'done' | 'error';
  summary?: string;
  isSubAgent?: boolean;
  subAgentOutput?: string;
}> {
  const parts = msg.parts || [];
  return parts
    .filter((p: any) => p.type === 'tool-invocation' || p.type?.startsWith('tool-') || p.type === 'dynamic-tool')
    .map((p: any) => {
      const state = String(p.state || '').toLowerCase();
      const isPreliminary = p.preliminary === true;
      const isStreaming = state === 'output-available' && isPreliminary;
      const isError = state === 'output-error' || (state === 'output-available' && !isPreliminary && p.errorText);
      const isDone = (state === 'output-available' && !isPreliminary) || (p.output !== undefined && !isPreliminary && !isError);
      const toolName = p.toolName || (p.type || '').replace('tool-', '');

      let summary: string | undefined;
      const output = typeof p.output === 'string' ? p.output : '';
      if (isStreaming) {
        const toolMatch = output.match(/工具:\s*(.+)/);
        summary = toolMatch ? toolMatch[1] : '执行中...';
      } else if (isDone) {
        summary = output.slice(0, 100) || '完成';
      } else if (isError) {
        summary = (p.errorText || output).slice(0, 100);
      } else if (state === 'call' || state === 'input-streaming' || state === 'input-available') {
        summary = '执行中...';
      }

      return {
        callId: p.toolCallId || p.type,
        toolName,
        status: isError ? 'error' : isDone ? 'done' : 'running',
        summary,
        isSubAgent: toolName === 'delegate_task',
        subAgentOutput: toolName === 'delegate_task' && isStreaming ? output : undefined,
      };
    });
}

// DB messages → UIMessage format conversion
function convertDBMessages(dbMsgs: any[]): UIMessage[] {
  return dbMsgs
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => {
      const content: string = m.content || '';
      const parts: any[] = [];
      let toolCalls: any[] = [];
      let displayContent = content;

      if (m.role === 'assistant' && content.includes('<!--EXEC_LOG')) {
        const logMatch = content.match(/<!--EXEC_LOG\n([\s\S]*?)\n-->/);
        if (logMatch) {
          const lines = logMatch[1].split('\n').filter(Boolean);
          toolCalls = lines.map((line: string) => {
            const match = line.match(/^\d+\.\s+(.+?):\s+(✅|❌)\s*(.*)/);
            if (match) {
              return { toolName: match[1], status: match[2] === '✅' ? 'done' : 'error', summary: match[3] };
            }
            return null;
          }).filter(Boolean);
          displayContent = content.replace(/\n\n<!--EXEC_LOG\n[\s\S]*?\n-->/, '');
        }
      }

      if (displayContent) {
        parts.push({ type: 'text', text: displayContent });
      }
      for (const tc of toolCalls) {
        parts.push({
          type: `tool-${tc.toolName}`,
          toolCallId: `hist-${tc.toolName}-${Math.random().toString(36).slice(2, 8)}`,
          state: tc.status === 'error' ? 'output-error' : 'output-available',
          input: {},
          ...(tc.status !== 'error' && { output: tc.summary }),
          ...(tc.status === 'error' && { errorText: tc.summary }),
        });
      }

      return {
        id: m.id || `msg-${Math.random().toString(36).slice(2)}`,
        role: m.role as 'user' | 'assistant',
        parts: parts.length > 0 ? parts : [{ type: 'text' as const, text: '' }],
        createdAt: new Date(m.created_at || m.createdAt || Date.now()),
      } as UIMessage;
    });
}

export function AiChat({ projectId, modelId, files, onFilesChanged }: AiChatProps) {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reuse shared file upload hook
  const {
    attachments,
    setAttachments,
    fileInputRef,
    handleFiles,
    removeAttachment,
    clearAttachments,
  } = useFileUpload({
    onError: (msg) => toast.error(msg),
  });

  // AI SDK useChat hook (workspace-specific API endpoint)
  const chat = useChat({
    transport: new DefaultChatTransport({ api: '/api/workspace/chat' }),
    messageMetadataSchema: z.object({ conversationId: z.string().optional() }).optional(),
    async onFinish({ message }) {
      onFilesChanged?.();
    },
    onError(error) {
      toast.error('AI 响应出错，请重试');
    },
  });

  const isLoading = chat.status === 'submitted' || chat.status === 'streaming';
  const isThinking = chat.status === 'submitted';

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  // Load history on mount or projectId change
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/workspace/messages?conversationId=' + projectId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            chat.setMessages(convertDBMessages(data));
          } else {
            chat.setMessages([]);
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    loadHistory();
  }, [projectId]);

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

    const content = input;
    setInput('');
    clearAttachments();

    chat.sendMessage(
      { text: content },
      {
        body: {
          modelId,
          projectId,
          conversationId: projectId,
          mode: 'coding',
          enable_search: true,
        },
      }
    );
  };

  // Convert UIMessage to Message for MessageBubble
  const toBubbleMessage = (msg: UIMessage): Message => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: extractTextContent(msg),
    attachments: [],
    createdAt: (msg as any).createdAt || new Date(),
  });

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
        <span className="text-sm font-medium truncate text-foreground">AI 编程助手</span>
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

      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 min-h-0">
        {chat.messages.length === 0 ? (
          <div className="text-center text-foreground/70 text-sm py-8 px-4">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-base font-medium">告诉我你想做什么</p>
            <p className="text-xs mt-2 leading-relaxed">AI 可以帮你创建文件、<br/>修改代码、执行命令</p>
          </div>
        ) : (
          chat.messages.map((message) => {
            const toolCalls = message.role === 'assistant' ? extractToolCallsFromMessage(message) : [];
            const isStreaming = message.role === 'assistant' && isLoading && message === chat.messages[chat.messages.length - 1];

            return (
              <MessageBubble
                key={message.id}
                message={toBubbleMessage(message)}
                isStreaming={isStreaming}
                conversationId={projectId}
              />
              /* Tool calls are now rendered inside MessageBubble via RenderedContent.
                 For workspace-specific tool calls, show them separately below. */
            );
          })
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

      <div className="border-t border-border p-2 safe-area-pb">
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
            placeholder="输入你的需求..."
            className="flex-1 min-w-0 bg-background border border-border rounded px-3 py-2 text-sm"
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
