'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, Moon, Sun, Monitor, Sparkles } from 'lucide-react';
import Sidebar from '@/components/sidebar/sidebar';
import MessageBubble from '@/components/chat/message-bubble';
import ChatInput from '@/components/chat/chat-input';
import ModelSelector from '@/components/chat/model-selector';
import { useTheme } from '@/components/theme-provider';
import type { Conversation, Message, ModelConfig } from '@/lib/types';

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 加载初始数据
  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setModels(d.data);
          // 优先选择 deepseek-v4-flash 作为默认模型
          const defaultModel = d.data.find((m: ModelConfig) => m.model_id === 'deepseek-v4-flash');
          if (defaultModel) {
            setSelectedModel('deepseek-v4-flash');
          } else if (d.data.length > 0) {
            setSelectedModel(d.data[0].model_id);
          }
        }
      })
      .catch(() => {});

    fetch('/api/conversations')
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setConversations(d.data);
      })
      .catch(() => {});
  }, []);

  // 自动滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 加载对话消息
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.data) {
        setMessages(data.data.messages || []);
        setActiveConvId(id);
        if (data.data.model_id) setSelectedModel(data.data.model_id);
      }
    } catch {
      // 静默处理
    }
  }, []);

  // 新建对话
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveConvId(null);
    setStreamingContent('');
  }, []);

  // 删除对话
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConvId === id) {
          setMessages([]);
          setActiveConvId(null);
        }
      } catch {
        // 静默处理
      }
    },
    [activeConvId]
  );

  // 发送消息
  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: Message = {
        id: 'temp-' + Date.now(),
        conversation_id: activeConvId || '',
        role: 'user',
        content,
        model_id: null,
        token_count: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamingContent('');

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const chatMessages = [...messages, { role: 'user', content }].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: activeConvId,
            model_id: selectedModel,
            messages: chatMessages,
          }),
          signal: abortController.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let fullContent = '';
        let convId = activeConvId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n').filter((l) => l.startsWith('data: '));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content' && data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                // 完成
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
              if (data.conversation_id) {
                convId = data.conversation_id;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }

        // 添加助手消息
        const assistantMsg: Message = {
          id: 'msg-' + Date.now(),
          conversation_id: convId || activeConvId || '',
          role: 'assistant',
          content: fullContent,
          model_id: selectedModel,
          token_count: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent('');

        // 更新对话列表
        if (convId && convId !== activeConvId) {
          setActiveConvId(convId);
          // 刷新对话列表
          const convRes = await fetch('/api/conversations');
          const convData = await convRes.json();
          if (convData.data) setConversations(convData.data);
        } else {
          // 更新 updated_at 用于排序
          const convRes = await fetch('/api/conversations');
          const convData = await convRes.json();
          if (convData.data) setConversations(convData.data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // 用户取消
        } else {
          const errorMsg: Message = {
            id: 'err-' + Date.now(),
            conversation_id: activeConvId || '',
            role: 'assistant',
            content: `错误：${error instanceof Error ? error.message : '获取响应失败'}`,
            model_id: null,
            token_count: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        setIsLoading(false);
        setStreamingContent('');
        abortRef.current = null;
      }
    },
    [messages, activeConvId, selectedModel]
  );

  // 停止流式输出
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 切换主题
  const cycleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={loadConversation}
        onNew={handleNewChat}
        onDelete={handleDelete}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h1 className="text-lg font-semibold hidden sm:block">AI 对话平台</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelect={setSelectedModel}
            />
            <button
              onClick={cycleTheme}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              {theme === 'dark' && <Moon size={18} />}
              {theme === 'light' && <Sun size={18} />}
              {theme === 'system' && <Monitor size={18} />}
            </button>
          </div>
        </header>

        {/* 聊天区域 */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streamingContent ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">有什么可以帮助你的？</h2>
                <p className="text-muted-foreground">
                  与任何 AI 模型开始对话，随时切换模型。
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role as 'user' | 'assistant'}
                  content={msg.content}
                  modelId={msg.model_id}
                />
              ))}
              {streamingContent && (
                <MessageBubble
                  role="assistant"
                  content={streamingContent}
                  isStreaming
                  modelId={selectedModel}
                />
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isLoading={isLoading}
          disabled={models.length === 0}
        />
      </main>
    </div>
  );
}
