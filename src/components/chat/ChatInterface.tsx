'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';
import { Send, Loader2, Paperclip, X, Image, FileText, Code, Brain, Wrench, CircleCheck, CircleX, LoaderCircle, MessageSquare, Plus, ChevronLeft, Trash2, Terminal, PenTool, BarChart3, Palette, MessageCircle, Square, RotateCcw, Download, Search, Pencil, ImageIcon, Clock, X as XIcon } from 'lucide-react';
import type { Message, Attachment } from '@/types';

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

/** Get icon component for attachment type */
function AttachmentIcon({ type }: { type: Attachment['type'] }) {
  switch (type) {
    case 'image': return <Image className="w-3 h-3" />;
    case 'code': return <Code className="w-3 h-3" />;
    default: return <FileText className="w-3 h-3" />;
  }
}

interface ToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  model_id?: string;
  created_at: string;
  updated_at: string;
}


// ============ 聊天模式 ============
const CHAT_MODES = [
  { id: 'coding', name: '编程', icon: Terminal, color: 'text-violet-400', placeholder: '告诉我你想做什么...' },
  { id: 'writing', name: '文案', icon: PenTool, color: 'text-amber-400', placeholder: '输入你的写作需求...' },
  { id: 'analysis', name: '分析', icon: BarChart3, color: 'text-emerald-400', placeholder: '描述你要分析的问题...' },
  { id: 'design', name: '设计', icon: Palette, color: 'text-pink-400', placeholder: '描述你的设计需求...' },
  { id: 'chat', name: '聊天', icon: MessageCircle, color: 'text-sky-400', placeholder: '随便聊聊...' },
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  // Streaming buffer: accumulate content and flush every 50ms
  const streamingRef = useRef<{ content: string; assistantId: string } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Conversation management
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedMode, setSelectedMode] = useState('coding');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const currentMode = CHAT_MODES.find(m => m.id === selectedMode);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [tasks, setTasks] = useState<Array<{id: string; title: string; prompt: string; nextRunAt?: string; isActive: boolean}>>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPrompt, setNewTaskPrompt] = useState('');
  const [newTaskRunIn, setNewTaskRunIn] = useState('1h');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data || []);
      }
    } catch {}
  };

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        const convData = data.data;
        if (convData?.messages) {
          const loadedMessages: Message[] = convData.messages.map((m: any) => {
            let msgContent = m.content || '';
            // Parse EXEC_LOG to restore tool call badges
            if (m.role === 'assistant' && msgContent.includes('<!--EXEC_LOG')) {
              const logMatch = msgContent.match(/<!--EXEC_LOG\n([\s\S]*?)\n-->/);
              if (logMatch) {
                const logContent = logMatch[1];
                const restoredCalls: ToolCall[] = [];
                const lines = logContent.split('\n');
                for (const line of lines) {
                  const match = line.match(/^\d+\.\s+(.+?):\s+(✅|❌)\s*(.*)/);
                  if (match) {
                    restoredCalls.push({
                      callId: 'hist-' + restoredCalls.length,
                      toolName: match[1],
                      status: match[2] === '✅' ? 'done' : 'error',
                      summary: match[3],
                    });
                  }
                }
                if (restoredCalls.length > 0) {
                  setToolCalls(restoredCalls);
                }
                // Remove EXEC_LOG from displayed content
                msgContent = msgContent.replace(/\n\n<!--EXEC_LOG\n[\s\S]*?\n-->/, '');
              }
            }
            return {
              id: m.id || Date.now().toString() + Math.random(),
              role: m.role,
              content: msgContent,
              createdAt: new Date(m.created_at || m.createdAt || Date.now()),
            };
          });
          setMessages(loadedMessages);
        } else {
          setMessages([]);
        }
        setCurrentConvId(convId);
        if (convData?.model_id) {
          setSelectedModel(convData.model_id);
        }
      }
    } catch {}
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentConvId(null);
    setToolCalls([]);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      if (currentConvId === convId) {
        startNewChat();
      }
      fetchConversations();
    } catch {}
  };

  // ===== 重命名对话 =====
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const startRename = (convId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConvId(convId);
    setRenameTitle(currentTitle);
  };

  const confirmRename = async (convId: string) => {
    if (!renameTitle.trim()) { setRenamingConvId(null); return; }
    try {
      await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      fetchConversations();
    } catch {}
    setRenamingConvId(null);
  };

  // Flush streaming content to React state every 50ms (batch rendering)
  const startFlushTimer = useCallback((assistantId: string) => {
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = setInterval(() => {
      if (streamingRef.current) {
        const { content } = streamingRef.current;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content } : m
          )
        );
      }
    }, 50);
  }, []);

  const stopFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    // Final flush
    if (streamingRef.current) {
      const { content, assistantId } = streamingRef.current;
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content } : m
        )
      );
      streamingRef.current = null;
    }
  }, []);

  // Handle file selection and convert to base64
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
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

  // Drag & drop handlers
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

  // ===== 停止生成 =====
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopFlushTimer();
    setIsLoading(false);
    setIsThinking(false);
  };

  // ===== 重新生成 =====
  const handleRegenerate = async () => {
    const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const messagesToKeep = messages.slice(0, actualIdx + 1);
    setMessages(messagesToKeep);
    setToolCalls([]);
    setIsLoading(true);
    setIsThinking(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', createdAt: new Date() }]);
    streamingRef.current = { content: '', assistantId };
    startFlushTimer(assistantId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const messagesPayload = messagesToKeep.map(m => ({ role: m.role, content: m.content + (m.attachments ? m.attachments.filter(a => a.type === 'image').map(a => '[image:' + a.url + ']').join('') : '') }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesPayload, modelId: selectedModel, mode: selectedMode, conversation_id: currentConvId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let errorMsg = '请求失败';
        try { const errData = await response.json(); if (errData.error) errorMsg = errData.error; } catch {}
        throw new Error(errorMsg);
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
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
                case 'content': setIsThinking(false); if (streamingRef.current) { streamingRef.current.content += event.content || ''; } break;
                case 'tool-start': setIsThinking(false); setToolCalls(prev => [...prev, { callId: event.callId || '', toolName: event.toolName || '', args: event.args, status: 'running' }]); break;
                case 'tool-result': setToolCalls(prev => prev.map(tc => tc.callId === event.callId ? { ...tc, status: event.success ? 'done' : 'error', summary: event.summary } : tc)); break;
                case 'done': if (event.conversation_id && !currentConvId) { setCurrentConvId(event.conversation_id); fetchConversations(); } break;
                case 'error': if (streamingRef.current) { streamingRef.current.content += `❌ ${event.error}`; } break;
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        if (streamingRef.current) { streamingRef.current.content += error instanceof Error ? error.message : '未知错误'; }
      }
    } finally {
      stopFlushTimer(); setIsLoading(false); setIsThinking(false); abortControllerRef.current = null;
    }
  };

  // ===== 导出对话 =====
  const handleExport = () => {
    const lines = messages.map(m => {
      const role = m.role === 'user' ? '🧑 用户' : '🤖 AI';
      return `### ${role}\n\n${m.content}\n`;
    });
    const content = `# 对话导出\n\n时间: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n${lines.join('\n---\n\n')}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `对话_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== 编辑消息重发 =====
  const handleEditMessage = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) { setEditingMessageId(messageId); setEditContent(msg.content); }
  };
  const handleSaveEdit = async () => {
    if (!editingMessageId) return;
    const idx = messages.findIndex(m => m.id === editingMessageId);
    if (idx === -1) return;
    const updated = [...messages];
    updated[idx] = { ...updated[idx], content: editContent };
    const toKeep = updated.slice(0, idx + 1);
    setMessages(toKeep);
    setEditingMessageId(null);
    setEditContent('');
    setToolCalls([]);
    setIsLoading(true);
    setIsThinking(true);
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', createdAt: new Date() }]);
    streamingRef.current = { content: '', assistantId };
    startFlushTimer(assistantId);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const messagesPayload = toKeep.map(m => ({ role: m.role, content: m.content + (m.attachments ? m.attachments.filter(a => a.type === 'image').map(a => '[image:' + a.url + ']').join('') : '') }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesPayload, modelId: selectedModel, mode: selectedMode, conversation_id: currentConvId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let errorMsg = '请求失败';
        try { const errData = await response.json(); if (errData.error) errorMsg = errData.error; } catch {}
        throw new Error(errorMsg);
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
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
                case 'content': setIsThinking(false); if (streamingRef.current) { streamingRef.current.content += event.content || ''; } break;
                case 'tool-start': setIsThinking(false); setToolCalls(prev => [...prev, { callId: event.callId || '', toolName: event.toolName || '', args: event.args, status: 'running' }]); break;
                case 'tool-result': setToolCalls(prev => prev.map(tc => tc.callId === event.callId ? { ...tc, status: event.success ? 'done' : 'error', summary: event.summary } : tc)); break;
                case 'done': if (event.conversation_id && !currentConvId) { setCurrentConvId(event.conversation_id); fetchConversations(); } break;
                case 'error': if (streamingRef.current) { streamingRef.current.content += `❌ ${event.error}`; } break;
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        if (streamingRef.current) { streamingRef.current.content += error instanceof Error ? error.message : '未知错误'; }
      }
    } finally {
      stopFlushTimer(); setIsLoading(false); setIsThinking(false); abortControllerRef.current = null;
    }
  };

  // ===== 图片生成 =====
  const handleGenerateImage = async () => {
    if (!input.trim() || isGeneratingImage) return;
    const prompt = input.trim();
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: '🎨 ' + prompt, createdAt: new Date() };
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '正在生成图片...', createdAt: new Date() };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setIsGeneratingImage(true);
    try {
      const res = await fetch('/api/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.images && data.images.length > 0) {
        const imgMd = data.images.map((img: any) => '![' + (img.revised_prompt || prompt) + '](' + img.url + ')').join('\n');
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: imgMd } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: '❌ ' + (data.error || '图片生成失败') } : m));
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: '❌ ' + (e.message || '未知错误') } : m));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // ===== 定时任务 =====
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) { const data = await res.json(); setTasks(data.data || []); }
    } catch {}
  };
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskPrompt.trim()) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle, prompt: newTaskPrompt, runIn: newTaskRunIn }),
      });
      setNewTaskTitle(''); setNewTaskPrompt('');
      fetchTasks();
    } catch {}
  };
  const handleDeleteTask = async (id: string) => {
    try { await fetch('/api/tasks?id=' + id, { method: 'DELETE' }); fetchTasks(); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);
    setIsThinking(true);
    setToolCalls([]);

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Start batch rendering
    streamingRef.current = { content: '', assistantId };
    startFlushTimer(assistantId);

    try {
      const messagesPayload = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content + (m.attachments ? m.attachments.filter(a => a.type === 'image').map(a => '[image:' + a.url + ']').join('') : ''),
      }));

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesPayload,
          modelId: selectedModel,
          mode: selectedMode,
          conversation_id: currentConvId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = '请求失败，请检查 API Key 配置';
        try { const errData = await response.json(); if (errData.error) errorMsg = errData.error; } catch {}
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // SSE format: events separated by double newline, each event prefixed with "data: "
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const sseEvent of events) {
            // Extract JSON from SSE "data: {...}" lines
            const dataLine = sseEvent.split('\n').find(l => l.startsWith('data: '));
            if (!dataLine) continue;
            const jsonStr = dataLine.slice(6); // strip "data: " prefix
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
                  setToolCalls(prev => [...prev, {
                    callId: event.callId || '',
                    toolName: event.toolName || '',
                    args: event.args,
                    status: 'running',
                  }]);
                  break;

                case 'tool-result':
                  setToolCalls(prev => prev.map(tc =>
                    tc.callId === event.callId
                      ? { ...tc, status: event.success ? 'done' : 'error', summary: event.summary }
                      : tc
                  ));
                  break;

                case 'done':
                  // Capture conversation_id from response
                  if (event.conversation_id && !currentConvId) {
                    setCurrentConvId(event.conversation_id);
                    fetchConversations(); // Refresh conversation list
                  }
                  break;

                case 'error':
                  if (streamingRef.current) {
                    streamingRef.current.content += `❌ ${event.error}`;
                  }
                  break;
              }
            } catch {
              // Parse failed, ignore
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户主动停止
      } else if (streamingRef.current) {
        streamingRef.current.content += error instanceof Error ? error.message : '抱歉，发生了未知错误';
      }
    } finally {
      abortControllerRef.current = null;
      stopFlushTimer();
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation Sidebar */}
      <div className={`${showSidebar ? 'w-64 min-w-[16rem]' : 'w-0 min-w-0'} border-r border-border bg-card transition-all duration-200 overflow-hidden flex flex-col shrink-0`}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium truncate">对话历史</span>
          <button onClick={() => setShowSidebar(false)} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="px-2 py-2 shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          {conversations.filter(conv => !searchQuery || conv.title.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                currentConvId === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                {renamingConvId !== conv.id && <div className="text-sm truncate">{conv.title}</div>}
                <div className="text-xs text-muted-foreground">
                  {new Date(conv.updated_at || conv.created_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
              {renamingConvId === conv.id ? (
                <input
                  type="text"
                  value={renameTitle}
                  onChange={e => setRenameTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmRename(conv.id); if (e.key === 'Escape') setRenamingConvId(null); }}
                  onBlur={() => confirmRename(conv.id)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm bg-background border border-primary rounded px-1.5 py-0.5 outline-none"
                  autoFocus
                />
              ) : (
                <>
                  <button
                    onClick={(e) => startRename(conv.id, conv.title, e)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="重命名"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
          {conversations.filter(conv => !searchQuery || conv.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {searchQuery ? '未找到匹配对话' : '暂无对话记录'}
            </div>
          )}
        </div>
        {/* Task button */}
        <div className="border-t border-border px-2 py-2 shrink-0">
          <button
            onClick={() => { setShowTaskPanel(true); fetchTasks(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <Clock className="w-4 h-4" />
            定时任务
          </button>
        </div>
      </div>

      {/* Task Panel Modal */}
      {showTaskPanel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTaskPanel(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">定时任务</span>
              <button onClick={() => setShowTaskPanel(false)} className="p-1 rounded hover:bg-muted"><XIcon className="w-4 h-4" /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {/* Create task */}
              <div className="space-y-2 pb-3 border-b border-border">
                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="任务标题" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm" />
                <textarea value={newTaskPrompt} onChange={e => setNewTaskPrompt(e.target.value)} placeholder="任务内容（AI 到时间会执行）" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm resize-none" rows={2} />
                <div className="flex gap-2">
                  <select value={newTaskRunIn} onChange={e => setNewTaskRunIn(e.target.value)} className="bg-input border border-border rounded-lg px-2 py-1.5 text-xs">
                    <option value="30m">30分钟后</option>
                    <option value="1h">1小时后</option>
                    <option value="2h">2小时后</option>
                    <option value="4h">4小时后</option>
                    <option value="1d">明天</option>
                  </select>
                  <button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || !newTaskPrompt.trim()} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50">创建</button>
                </div>
              </div>
              {/* Task list */}
              {tasks.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">暂无定时任务</div>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.prompt}</div>
                      {t.nextRunAt && <div className="text-[10px] text-muted-foreground mt-0.5">下次: {new Date(t.nextRunAt).toLocaleString('zh-CN')}</div>}
                    </div>
                    <button onClick={() => handleDeleteTask(t.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: sidebar toggle + model selector */}
        <div className="border-b border-border px-3 py-2 md:px-4 md:py-3 shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${showSidebar ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="对话历史"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          {/* Mode Selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-input hover:bg-muted transition-colors text-sm"
            >
              {(() => { const Icon = currentMode?.icon; return Icon ? <Icon className={"w-4 h-4 " + (currentMode?.color || '')} /> : null; })()}
              <span className="hidden sm:inline">{CHAT_MODES.find(m => m.id === selectedMode)?.name}</span>
            </button>
            {showModeMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowModeMenu(false)} />
                <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                  {CHAT_MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedMode(m.id); setShowModeMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        selectedMode === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <m.icon className={"w-4 h-4 " + m.color} />
                      <span>{m.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative flex-1 max-w-full">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>
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
                onClick={startNewChat}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
                title="新建对话"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Messages + drag area */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 relative min-h-0"
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <Paperclip className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-primary">释放以上传文件</p>
              </div>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center px-4">
                <div className="mb-4 flex justify-center">{(() => { const Icon = currentMode?.icon; return Icon ? <Icon className="w-10 h-10" /> : <span className="text-4xl">🤖</span>; })()}</div>
                <h3 className="text-lg font-medium mb-2">{CHAT_MODES.find(m => m.id === selectedMode)?.name || 'AI'} 模式</h3>
                <p className="text-sm">选择模型和模式，输入消息开始对话</p>
                <p className="text-xs mt-2 text-muted-foreground/60">支持拖拽文件到对话区域上传附件</p>
              </div>
            </div>
          )}
          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isEditing={editingMessageId === message.id}
              editContent={editContent}
              onEdit={() => handleEditMessage(message.id)}
              onEditChange={setEditContent}
              onEditSave={handleSaveEdit}
              onEditCancel={() => { setEditingMessageId(null); setEditContent(''); }}
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
          {toolCalls.length > 0 && (
            <div className="space-y-2">
              {toolCalls.map(tc => (
                <div
                  key={tc.callId}
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                    tc.status === 'running' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
                    tc.status === 'done' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' :
                    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  }`}
                >
                  {tc.status === 'running' && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  {tc.status === 'done' && <CircleCheck className="w-3.5 h-3.5" />}
                  {tc.status === 'error' && <CircleX className="w-3.5 h-3.5" />}
                  <Wrench className="w-3.5 h-3.5" />
                  <span className="font-medium">{{createFile:"创建文件",editFile:"修改文件",deleteFile:"删除文件",readFile:"读取文件",runCommand:"执行命令",deploy:"部署项目",searchWeb:"联网搜索",saveMemory:"保存记忆"}[tc.toolName] || tc.toolName}</span>
                  {tc.summary && <span className="text-muted-foreground">— {tc.summary}</span>}
                </div>
              ))}
            </div>
          )}

{/* Regenerate button */}
          {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                重新生成
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

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
                    onClick={() => removeAttachment(att.id)}
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

        {/* Input */}
        <div className="border-t border-border px-3 py-3 md:px-4 md:py-4 shrink-0 safe-area-pb">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center flex-nowrap">
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
            {selectedMode === 'design' && (
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !input.trim()}
              className="p-2 text-amber-400 hover:text-amber-300 transition-colors rounded-lg hover:bg-muted shrink-0 disabled:opacity-50"
              title="生成图片"
              aria-label="生成图片"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          )}
          <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors rounded-lg hover:bg-muted active:bg-muted shrink-0"
              title="上传附件"
              aria-label="上传附件"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={CHAT_MODES.find(m => m.id === selectedMode)?.placeholder || "输入消息..."}
              className="flex-1 min-w-0 bg-input border border-border rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                className="bg-destructive text-destructive-foreground px-3 py-2 rounded-lg hover:bg-destructive/90 active:bg-destructive/80 shrink-0"
                title="停止生成"
              >
                <Square className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
