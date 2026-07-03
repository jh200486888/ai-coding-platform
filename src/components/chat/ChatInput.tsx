"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, X, Square, ImageIcon, FileText, Code, Mic, Globe, MoreHorizontal } from 'lucide-react';
import type { Attachment } from '@/types';
import { SpeechInput } from '@/components/chat/SpeechInput';

interface AttachmentIconProps {
  type: Attachment['type'];
}

function AttachmentIcon({ type }: AttachmentIconProps) {
  switch (type) {
    case 'image':
      return <ImageIcon className="w-4 h-4" />;
    case 'code':
      return <Code className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onFileSelect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedMode: string;
  CHAT_MODES: Array<{ id: string; name: string; placeholder: string }>;
  isGeneratingImage: boolean;
  onGenerateImage: () => void;
  enableSearch?: boolean;
  onToggleSearch?: () => void;
  isLoggedIn?: boolean;
  onPasteImage?: (files: FileList) => void;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  attachments,
  onRemoveAttachment,
  onFileSelect,
  fileInputRef,
  selectedMode,
  CHAT_MODES,
  isGeneratingImage,
  onGenerateImage,
  enableSearch = true,
  onToggleSearch,
  isLoggedIn = true,
  onPasteImage,
}: ChatInputProps) {
  const currentMode = CHAT_MODES.find(m => m.id === selectedMode);
  const canSubmit = input.trim() || attachments.length > 0;
  const [showExtraActions, setShowExtraActions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    // Cap at ~6 rows (160px)
    const maxH = 160;
    ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px';
  }, [input]);

  // Handle keyboard: Ctrl/Cmd+Enter to submit, Enter for newline
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSubmit && !isLoading) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
    // Enter without modifier = newline (default textarea behavior)
  }, [canSubmit, isLoading, onSubmit]);

  return (
    <>
      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="border-t border-border px-3 py-2 md:px-4 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {attachments.map(att => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs max-w-full"
              >
                {att.type === 'image' ? (
                  <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <AttachmentIcon type={att.type} />
                )}
                <span className="truncate max-w-[120px]">{att.name}</span>
                <button
                  onClick={() => onRemoveAttachment(att.id)}
                  className="shrink-0 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center ml-1"
                  aria-label={`移除 ${att.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Login guide bar */}
      {!isLoggedIn && (
        <div className="border-t border-border px-3 py-2 md:px-4 bg-primary/5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">💡 登录后可保存对话记录、使用更多功能</span>
            <a href="/login" className="text-primary font-medium hover:underline ml-auto shrink-0">
              登录领积分 →
            </a>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border px-2 py-2 md:px-4 md:py-4 shrink-0 safe-area-pb">
        <form onSubmit={onSubmit} className="flex gap-1.5 md:gap-2 items-end flex-nowrap">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                const event = new CustomEvent('files-selected', { detail: e.target.files });
                e.target.dispatchEvent(event);
              }
              e.target.value = '';
            }}
          />
          
          {/* Mobile: expandable extra actions */}
          {showExtraActions && (
            <div className="flex items-center gap-0.5 md:hidden">
              {/* Image generation button (design mode only) */}
              {selectedMode === 'design' && (
                <button
                  type="button"
                  onClick={onGenerateImage}
                  disabled={isGeneratingImage || !input.trim()}
                  className="p-2 text-amber-400 hover:text-amber-300 transition-colors rounded-lg hover:bg-muted shrink-0 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="生成图片"
                  aria-label="生成图片"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
              )}
              {/* Attachment button */}
              <button
                type="button"
                onClick={onFileSelect}
                className="p-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors rounded-lg hover:bg-muted active:bg-muted shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="上传附件"
                aria-label="上传附件"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              {/* Web Search Toggle */}
              <button
                type="button"
                onClick={onToggleSearch}
                className={`p-2 rounded-lg transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${enableSearch ? 'text-blue-400 hover:text-blue-300 bg-blue-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                title={enableSearch ? '联网搜索已开启（点击关闭）' : '联网搜索已关闭（点击开启）'}
                aria-label="切换联网搜索"
              >
                <Globe className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Desktop: always show all actions */}
          <div className="hidden md:flex items-center gap-1">
            {/* Image generation button (design mode only) */}
            {selectedMode === 'design' && (
              <button
                type="button"
                onClick={onGenerateImage}
                disabled={isGeneratingImage || !input.trim()}
                className="p-2 text-amber-400 hover:text-amber-300 transition-colors rounded-lg hover:bg-muted shrink-0 disabled:opacity-50"
                title="生成图片"
                aria-label="生成图片"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Voice input */}
          <SpeechInput
            onTranscriptionChange={onInputChange}
            disabled={isLoading}
            size="icon"
            variant="ghost"
          />

          {/* Mobile: More button to toggle extra actions */}
          <button
            type="button"
            onClick={() => setShowExtraActions(!showExtraActions)}
            className={`md:hidden p-2 rounded-lg transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${showExtraActions ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title="更多操作"
            aria-label="更多操作"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Desktop: Attachment and Search buttons */}
          <button
            type="button"
            onClick={onFileSelect}
            className="hidden md:flex p-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors rounded-lg hover:bg-muted active:bg-muted shrink-0 items-center justify-center"
            title="上传附件"
            aria-label="上传附件"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onToggleSearch}
            className={`hidden md:flex p-2 rounded-lg transition-colors shrink-0 items-center justify-center ${enableSearch ? 'text-blue-400 hover:text-blue-300 bg-blue-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title={enableSearch ? '联网搜索已开启（点击关闭）' : '联网搜索已关闭（点击开启）'}
            aria-label="切换联网搜索"
          >
            <Globe className="w-5 h-5" />
          </button>

          {/* Textarea input (auto-growing) */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (items) {
                const imageFiles: File[] = [];
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) imageFiles.push(file);
                  }
                }
                if (imageFiles.length > 0 && onPasteImage) {
                  e.preventDefault();
                  const dt = new DataTransfer();
                  imageFiles.forEach(f => dt.items.add(f));
                  onPasteImage(dt.files);
                }
              }
            }}
            placeholder={currentMode?.placeholder || "输入消息... (Enter换行, Ctrl+Enter发送)"}
            rows={1}
            className="flex-1 min-w-0 bg-input border border-border rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed"
            style={{ maxHeight: 160 }}
            disabled={isLoading}
          />

          {/* Submit or Stop button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="bg-destructive text-destructive-foreground px-3 py-2 rounded-lg hover:bg-destructive/90 active:bg-destructive/80 shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </>
  );
}
