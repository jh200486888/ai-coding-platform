"use client";

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X, Square, ImageIcon, FileText, Code } from 'lucide-react';
import type { Attachment } from '@/types';

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
}: ChatInputProps) {
  const currentMode = CHAT_MODES.find(m => m.id === selectedMode);
  const canSubmit = input.trim() || attachments.length > 0;

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

      {/* Input area */}
      <div className="border-t border-border px-3 py-3 md:px-4 md:py-4 shrink-0 safe-area-pb">
        <form onSubmit={onSubmit} className="flex gap-2 items-center flex-nowrap">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                // Trigger parent handler via custom event
                const event = new CustomEvent('files-selected', { detail: e.target.files });
                e.target.dispatchEvent(event);
              }
              e.target.value = '';
            }}
          />
          
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
          
          {/* Attachment button */}
          <button
            type="button"
            onClick={onFileSelect}
            className="p-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors rounded-lg hover:bg-muted active:bg-muted shrink-0"
            title="上传附件"
            aria-label="上传附件"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder={currentMode?.placeholder || "输入消息..."}
            className="flex-1 min-w-0 bg-input border border-border rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />

          {/* Submit or Stop button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="bg-destructive text-destructive-foreground px-3 py-2 rounded-lg hover:bg-destructive/90 active:bg-destructive/80 shrink-0"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </>
  );
}
