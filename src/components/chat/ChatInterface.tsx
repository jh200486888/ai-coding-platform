"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare, Plus, Download, Square, ImageIcon, Trash2,
  Loader2
} from 'lucide-react';
import type { Message, Attachment } from '@/types';
import type { UIMessage } from 'ai';

// Hooks
import { useChatLogic } from './hooks/use-chat-logic';
import { useConversations } from './hooks/use-conversations';
import { useFileUpload } from './hooks/use-file-upload';

// Components
import { ConversationSidebar } from './ConversationSidebar';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ModelSelector } from './ModelSelector';

// Types
interface ChatMode {
  id: string;
  name: string;
  icon: any;
  color: string;
  placeholder: string;
}

// Constants
const CHAT_MODES: ChatMode[] = [
  { id: 'coding', name: '编程', icon: null, color: 'text-violet-400', placeholder: '告诉我你想做什么...' },
  { id: 'writing', name: '文案', icon: null, color: 'text-amber-400', placeholder: '输入你的写作需求...' },
  { id: 'analysis', name: '分析', icon: null, color: 'text-emerald-400', placeholder: '描述你要分析的问题...' },
  { id: 'design', name: '设计', icon: null, color: 'text-pink-400', placeholder: '描述你的设计需求...' },
  { id: 'chat', name: '聊天', icon: null, color: 'text-sky-400', placeholder: '随便聊聊...' },
];

export function ChatInterface() {
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash');

  // Load default model from admin settings
  useEffect(() => {
    const loadDefaultModel = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          const defaultModel = data.data?.default_model;
          if (defaultModel) setSelectedModel(defaultModel);
        }
      } catch {}
    };
    loadDefaultModel();
  }, []);
  const [selectedMode, setSelectedMode] = useState('coding');
  const [showSidebar, setShowSidebar] = useState(false);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Task panel state
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [tasks, setTasks] = useState<Array<{id: string; title: string; prompt: string; nextRunAt?: string; isActive: boolean}>>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPrompt, setNewTaskPrompt] = useState('');
  const [newTaskRunIn, setNewTaskRunIn] = useState('1h');
  
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const currentMode = CHAT_MODES.find(m => m.id === selectedMode);

  // Conversations hook
  const {
    conversations,
    currentConvId,
    setCurrentConvId,
    renamingConvId,
    renameTitle,
    setRenameTitle,
    fetchConversations,
    deleteConversation,
    startRename,
    confirmRename,
    cancelRename,
  } = useConversations({
    onConversationLoaded: (convId) => {
      // Conversation loaded callback
    },
  });

  // File upload hook
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

  // Chat logic hook (AI SDK useChat)
  const {
    messages,
    setMessages,
    isLoading,
    isThinking,
    messagesEndRef,
    sendMessage,
    handleStop,
    loadConversation,
    startNewChat,
    chat,
  } = useChatLogic({
    currentConvId,
    selectedModel,
    selectedMode,
    attachments,
    onConversationCreated: (convId) => {
      if (convId) setCurrentConvId(convId);
      fetchConversations();
    },
  });

  // 从当前助手消息的 parts 中提取工具调用（AI SDK 原生方式）
  const toolCalls = (() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return [];
    return (lastAssistant as any).parts
      ?.filter((p: any) => p.type?.startsWith('tool-') && p.toolInvocation)
      .map((p: any) => ({
        callId: p.toolInvocation.toolCallId || p.type,
        toolName: p.toolInvocation.toolName || p.type.replace('tool-', ''),
        status: p.toolInvocation.state === 'output-error' ? 'error'
              : p.toolInvocation.output !== undefined ? 'done' : 'running',
        summary: typeof p.toolInvocation.output === 'string'
          ? p.toolInvocation.output.slice(0, 100)
          : (p.toolInvocation.errorText || '').slice(0, 100),
      })) || [];
  })();

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load conversation when currentConvId changes
  useEffect(() => {
    if (currentConvId) {
      loadConversation(currentConvId);
    }
  }, [currentConvId]);

  // Handlers
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    
    const content = input;
    const currentAttachments = [...attachments];
    
    setInput('');
    clearAttachments();
    
    await sendMessage(content, currentAttachments);
  }, [input, attachments, sendMessage, clearAttachments]);

  const handleRegenerate = useCallback(() => {
    chat.regenerate();
  }, [chat.regenerate]);

  const handleNewChat = useCallback(() => {
    startNewChat();
    setInput('');
    clearAttachments();
    setEditingMessageId(null);
    setEditContent('');
  }, [startNewChat, setCurrentConvId, clearAttachments]);

  const handleDeleteConversation = useCallback((convId: string, e: React.MouseEvent) => {
    deleteConversation(convId, handleNewChat);
  }, [deleteConversation, handleNewChat]);

  const handleExport = useCallback(() => {
    if (messages.length === 0) {
      toast.error('没有可导出的对话');
      return;
    }
    const content = messages.map((m: any) => {
      const role = m.role === 'user' ? '用户' : '助手';
      const text = (m.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      return `[${role}] ${text}`;
    }).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `对话_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('对话已导出');
  }, [messages]);

  const handleEditMessage = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.role === 'user') {
      setEditingMessageId(messageId);
      setEditContent((msg as any).content || (msg as any).parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '');
      // Don't truncate messages here - edit box is shown in-place
    }
  }, [messages]);

  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim()) {
      setEditingMessageId(null);
      setEditContent('');
      return;
    }
    const content = editContent;
    // Remove the edited message and all following messages, then resend
    if (editingMessageId) {
      const idx = messages.findIndex(m => m.id === editingMessageId);
      if (idx >= 0) {
        setMessages(messages.slice(0, idx));
      }
    }
    setEditingMessageId(null);
    setEditContent('');
    setInput('');
    await sendMessage(content, []);
  }, [editContent, editingMessageId, messages, chat.setMessages, sendMessage]);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  // Image generation (design mode)
  const handleGenerateImage = useCallback(async () => {
    if (!input.trim() || isGeneratingImage) return;
    
    setIsGeneratingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Add image as attachment
        const attachment: Attachment = {
          id: `img-${Date.now()}`,
          name: 'generated-image.png',
          type: 'image',
          mimeType: 'image/png',
          size: 0,
          url: data.url || data.data?.url,
        };
        setAttachments(prev => [...prev, attachment]);
        toast.success('图片已生成');
      } else {
        toast.error('图片生成失败');
      }
    } catch {
      toast.error('图片生成失败');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [input, isGeneratingImage, setAttachments]);

  // Task management
  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !newTaskPrompt.trim()) return;
    
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          prompt: newTaskPrompt,
          runIn: newTaskRunIn,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => [...prev, data.data]);
        setNewTaskTitle('');
        setNewTaskPrompt('');
        toast.success('定时任务已创建');
      }
    } catch {
      toast.error('创建任务失败');
    }
  }, [newTaskTitle, newTaskPrompt, newTaskRunIn]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch {
      toast.error('删除任务失败');
    }
  }, []);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  // Handle files selected from input
  useEffect(() => {
    const handleFilesEvent = (e: Event) => {
      const files = (e as CustomEvent).detail as FileList;
      handleFiles(files);
    };
    
    fileInputRef.current?.addEventListener('files-selected', handleFilesEvent);
    return () => {
      fileInputRef.current?.removeEventListener('files-selected', handleFilesEvent);
    };
  }, [fileInputRef, handleFiles]);

  return (
    <div className="flex h-full relative">
      {/* Sidebar */}
      <ConversationSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        conversations={conversations}
        currentConvId={currentConvId}
        onSelectConversation={(convId) => {
          setCurrentConvId(convId);
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        renamingConvId={renamingConvId}
        renameTitle={renameTitle}
        onStartRename={startRename}
        onConfirmRename={confirmRename}
        onCancelRename={cancelRename}
        onRenameChange={setRenameTitle}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="border-b border-border px-3 py-2 md:px-4 md:py-3 shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              showSidebar ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
            title="对话历史"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Mode Selector */}
          <ModeSelector
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            CHAT_MODES={CHAT_MODES}
          />

          {/* Model Selector */}
          <div className="relative flex-1 max-w-full">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>

          {/* Actions */}
          {currentConvId && (
            <>
              <button
                onClick={handleExport}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
                title="导出对话"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
                title="新建对话"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Messages */}
        <ChatMessages
          messages={messages as any}
          isLoading={isLoading}
          isThinking={isThinking}
          toolCalls={toolCalls}
          messagesEndRef={messagesEndRef}
          editingMessageId={editingMessageId}
          editContent={editContent}
          currentMode={currentMode || CHAT_MODES[0]}
          onEditMessage={handleEditMessage}
          onEditChange={setEditContent}
          onEditSave={handleSaveEdit}
          onEditCancel={handleEditCancel}
          onRegenerate={handleRegenerate}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          isDragging={isDragging}
          CHAT_MODES={CHAT_MODES}
        />

        {/* Input */}
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={handleStop}
          attachments={attachments}
          onRemoveAttachment={removeAttachment}
          onFileSelect={handleFileSelect}
          fileInputRef={fileInputRef}
          selectedMode={selectedMode}
          CHAT_MODES={CHAT_MODES}
          isGeneratingImage={isGeneratingImage}
          onGenerateImage={handleGenerateImage}
        />
      </div>
    </div>
  );
}

// Mode Selector component (inline for simplicity)
function ModeSelector({
  selectedMode,
  onModeChange,
  CHAT_MODES,
}: {
  selectedMode: string;
  onModeChange: (mode: string) => void;
  CHAT_MODES: ChatMode[];
}) {
  const [showMenu, setShowMenu] = useState(false);
  const currentMode = CHAT_MODES.find(m => m.id === selectedMode);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-input hover:bg-muted transition-colors text-sm"
      >
        <span className={`w-4 h-4 ${currentMode?.color || ''}`} />
        <span className="hidden sm:inline">
          {CHAT_MODES.find(m => m.id === selectedMode)?.name}
        </span>
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
            {CHAT_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { onModeChange(m.id); setShowMenu(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  selectedMode === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
              >
                <span className={`w-4 h-4 ${m.color}`} />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
