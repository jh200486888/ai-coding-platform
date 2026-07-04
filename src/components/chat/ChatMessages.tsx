"use client";

import { useRef, useEffect } from 'react';
import { Brain, RotateCcw, Sparkles, Code, FileText, Lightbulb, Search, PenTool } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ToolCallDisplay } from './tool-call-display';
import type { Message } from '@/types';

interface ToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  isThinking: boolean;
  toolCalls: ToolCall[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  editingMessageId: string | null;
  editContent: string;
  currentMode: { id: string; name: string; icon: any; color: string; placeholder: string };
  onEditMessage: (messageId: string) => void;
  onEditChange: (content: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRegenerate: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  CHAT_MODES: Array<{ id: string; name: string; icon: any; color: string; placeholder: string }>;
  conversationId?: string;
  onStarterPromptClick?: (prompt: string) => void;
}

// Starter prompts per mode
const STARTER_PROMPTS: Record<string, Array<{ icon: any; label: string; prompt: string }>> = {
  coding: [
    { icon: Code, label: '帮我写一个 React 组件', prompt: '帮我写一个 React 组件，实现一个带动画的计数器' },
    { icon: FileText, label: '分析这段代码的问题', prompt: '请帮我分析以下代码可能存在的问题，并给出优化建议：' },
    { icon: Lightbulb, label: '设计一个 REST API', prompt: '帮我设计一个用户管理系统的 REST API，包括注册、登录、CRUD 操作' },
    { icon: Search, label: '解释这段报错', prompt: '帮我解释以下错误信息并给出解决方案：' },
  ],
  design: [
    { icon: PenTool, label: '设计一个登录页面', prompt: '帮我设计一个现代化的登录页面，要求简洁美观' },
    { icon: Sparkles, label: '生成产品宣传图', prompt: '帮我生成一张产品宣传图片，风格简约大气' },
    { icon: Code, label: '设计一个仪表盘', prompt: '帮我设计一个数据分析仪表盘的 UI，包含图表和统计卡片' },
    { icon: FileText, label: '设计 Landing Page', prompt: '帮我设计一个 SaaS 产品的 Landing Page' },
  ],
  general: [
    { icon: Lightbulb, label: '帮我写一份工作计划', prompt: '帮我写一份下周的工作计划，包含具体的任务分解和时间安排' },
    { icon: FileText, label: '翻译并润色这段文字', prompt: '请帮我把以下中文翻译成英文，并润色使其更加专业：' },
    { icon: Search, label: '总结一篇长文章', prompt: '请帮我总结以下文章的核心要点：' },
    { icon: Sparkles, label: '头脑风暴创意', prompt: '我想做一个创业项目，请帮我头脑风暴一些创新想法' },
  ],
};

export function ChatMessages({
  messages,
  isLoading,
  isThinking,
  toolCalls,
  messagesEndRef,
  editingMessageId,
  editContent,
  currentMode,
  onEditMessage,
  onEditChange,
  onEditSave,
  onEditCancel,
  onRegenerate,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  CHAT_MODES,
  conversationId,
  onStarterPromptClick,
}: ChatMessagesProps) {
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get starter prompts for current mode
  const modeStarters = STARTER_PROMPTS[currentMode?.id] || STARTER_PROMPTS['general'];

  return (
    <div
      ref={dropZoneRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 relative min-h-0"
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center px-4">
            <div className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 text-primary">
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2.0.1.102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
            <p className="text-xs md:text-sm font-medium text-primary">释放以上传文件</p>
          </div>
        </div>
      )}

      {/* Empty state with starter prompts */}
      {(!messages || messages.length === 0) && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center px-4 max-w-2xl w-full">
            <div className="mb-4 flex justify-center">
              {currentMode?.icon ? (
                <currentMode.icon className="w-10 h-10" />
              ) : (
                <span className="text-4xl">🤖</span>
              )}
            </div>
            <h3 className="text-lg font-medium mb-2">
              {CHAT_MODES.find(m => m.id === currentMode?.id)?.name || 'AI'} 模式
            </h3>
            <p className="text-sm mb-6">选择模型和模式，输入消息开始对话</p>
            
            {/* Starter prompt cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 mt-4">
              {modeStarters.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onStarterPromptClick?.(item.prompt)}
                    className="flex items-start gap-3 p-3 md:p-4 rounded-xl border border-border bg-card hover:bg-muted/80 hover:border-primary/30 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {item.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.prompt}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs mt-4 text-muted-foreground/60">支持拖拽文件到对话区域上传附件</p>
          </div>
        </div>
      )}

      {/* Messages */}
      {(messages || []).filter(Boolean).map((message, index) => (
        <MessageBubble
          key={message.id}
          conversationId={conversationId}
          message={message}
          isStreaming={isLoading && message.role === 'assistant' && messages && index === messages.length - 1}
          isEditing={editingMessageId === message.id}
          editContent={editContent}
          onEdit={() => onEditMessage(message.id)}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
        />
      ))}

      {/* Thinking animation */}
      {isThinking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Brain className="w-4 h-4" />
          <span>AI 正在思考...</span>
        </div>
      )}

      {/* Tool calls display */}
      {toolCalls.length > 0 && <ToolCallDisplay toolCalls={toolCalls} />}

      {/* Regenerate button */}
      {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重新生成
          </button>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
