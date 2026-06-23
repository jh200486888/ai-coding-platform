'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Image, FileText, Code } from 'lucide-react';
import type { WorkspaceMessage, WorkspaceFile, Attachment } from '@/types';

interface AiChatProps {
  messages: WorkspaceMessage[];
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  files: WorkspaceFile[];
}

/** Maximum file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Convert a File to a base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Classify a file into attachment type */
function classifyFile(file: File): Attachment['type'] {
  if (file.type.startsWith('image/')) return 'image';
  const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.css', '.html', '.json', '.yaml', '.yml', '.toml', '.sql', '.sh', '.bash', '.zsh'];
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (codeExts.includes(ext)) return 'code';
  return 'document';
}

/** Icon for attachment type */
function AttachmentTypeIcon({ type }: { type: Attachment['type'] }) {
  switch (type) {
    case 'image': return <Image className="w-3 h-3" />;
    case 'code': return <Code className="w-3 h-3" />;
    default: return <FileText className="w-3 h-3" />;
  }
}

export function AiChat({ messages, onSendMessage, files }: AiChatProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection and convert to base64
  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`文件 "${file.name}" 超过 5MB 限制`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          type: classifyFile(file),
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          url: base64,
        });
      } catch {
        alert(`无法读取文件 "${file.name}"`);
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Drag & drop
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
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    onSendMessage(input, attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
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

      {/* 标题 */}
      <div className="h-10 flex items-center px-4 border-b border-border">
        <span className="text-sm font-medium">AI 编程助手</span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <div className="text-4xl mb-4">🤖</div>
            <p>开始与 AI 编程助手对话</p>
            <p className="text-xs mt-2">AI 可以帮你编写代码、解释概念、调试问题</p>
            <p className="text-xs mt-1 text-muted-foreground/60">支持拖拽文件上传附件</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {message.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-1">
                        {att.type === 'image' ? (
                          <img
                            src={att.url}
                            alt={att.name}
                            className="max-w-[120px] max-h-[80px] rounded object-cover"
                          />
                        ) : (
                          <div className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] ${
                            message.role === 'user' ? 'bg-primary-foreground/20' : 'bg-background/50'
                          }`}>
                            <AttachmentTypeIcon type={att.type} />
                            <span className="max-w-[80px] truncate">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 附件预览 */}
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

      {/* 输入区域 */}
      <div className="border-t border-border p-2">
        <div className="flex gap-2">
          {/* Hidden file input */}
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

          {/* Paperclip button */}
          <button
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
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息..."
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && attachments.length === 0}
            className="p-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
