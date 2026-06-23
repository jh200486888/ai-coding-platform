'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { UploadArea } from './UploadArea';
import type { WorkspaceMessage, WorkspaceFile } from '@/types';

interface AiChatProps {
  messages: WorkspaceMessage[];
  onSendMessage: (content: string, attachments?: string[]) => void;
  files: WorkspaceFile[];
}

export function AiChat({ messages, onSendMessage, files }: AiChatProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input, attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
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
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 text-xs opacity-70">
                    📎 {message.attachments.length} 个附件
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 上传区域 */}
      {showUpload && (
        <div className="border-t border-border p-2">
          <UploadArea
            onUpload={url => {
              setAttachments(prev => [...prev, url]);
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* 附件预览 */}
      {attachments.length > 0 && (
        <div className="border-t border-border p-2 flex gap-2 flex-wrap">
          {attachments.map((url, i) => (
            <div key={i} className="text-xs bg-muted rounded px-2 py-1 flex items-center gap-1">
              📎 附件 {i + 1}
              <button
                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                className="text-destructive hover:text-destructive/80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区域 */}
      <div className="border-t border-border p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="p-2 text-muted-foreground hover:text-foreground"
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
            disabled={!input.trim()}
            className="p-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
