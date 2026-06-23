'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import MarkdownRenderer from '@/components/chat/markdown-renderer';
import { AttachmentUpload, Attachment } from './attachment-upload';

export interface WorkspaceMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  created_at?: string;
}

interface AIChatPanelProps {
  messages: WorkspaceMessage[];
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  modelId: string;
  onModelChange: (modelId: string) => void;
  models: { id: string; name: string; provider: string }[];
  onFileUpdate?: (path: string, content: string) => void;
}

export function AIChatPanel({
  messages,
  onSendMessage,
  isLoading,
  modelId,
  onModelChange,
  models,
  onFileUpdate,
}: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading) return;

    onSendMessage(input, attachments);
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Parse file updates from assistant messages
  const parseFileUpdates = (content: string) => {
    const updates: { path: string; content: string }[] = [];
    const regex = /```file:(.+?)\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      updates.push({
        path: match[1].trim(),
        content: match[2].trim(),
      });
    }
    return updates;
  };

  return (
    <div className="h-full flex flex-col bg-[#16161e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-medium text-gray-200">AI 编程助手</span>
        </div>
        <select
          value={modelId}
          onChange={(e) => onModelChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-primary"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-lg mb-2">AI 编程助手</p>
            <p className="text-sm">
              我可以帮你编写、修改、调试代码。
              <br />
              试试说："帮我创建一个 React 组件"
            </p>
          </div>
        )}

        {messages.map((message) => {
          const fileUpdates = message.role === 'assistant' ? parseFileUpdates(message.content) : [];
          
          return (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-4 py-3',
                  message.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-gray-800 text-gray-200'
                )}
              >
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {message.attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1 bg-gray-700/50 rounded px-2 py-1 text-xs"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[100px]">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Content */}
                {message.role === 'assistant' ? (
                  <div className="prose prose-inverse prose-sm max-w-none">
                    <MarkdownRenderer content={message.content} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                {/* File updates */}
                {fileUpdates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-2">创建/更新的文件：</p>
                    <div className="space-y-1">
                      {fileUpdates.map((update, i) => (
                        <button
                          key={i}
                          onClick={() => onFileUpdate?.(update.path, update.content)}
                          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 bg-gray-900/50 rounded px-2 py-1 w-full text-left"
                        >
                          <FileCode className="w-3 h-3" />
                          <span className="truncate">{update.path}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-gray-800 rounded-lg px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 p-4">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1 text-sm"
              >
                <Paperclip className="w-3 h-3 text-gray-400" />
                <span className="truncate max-w-[100px]">{att.name}</span>
                <button
                  onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <AttachmentUpload onAttachmentsChange={setAttachments} />
          
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Shift+Enter 换行)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-12 text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-primary"
              rows={1}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className={cn(
              'p-3 rounded-lg transition-colors',
              isLoading || (!input.trim() && attachments.length === 0)
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary/90'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
