import { useState, useRef, useCallback, useEffect } from 'react';
import type { Message } from '@/types';

interface ToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
}

interface UseChatLogicOptions {
  currentConvId: string | null;
  selectedModel: string;
  selectedMode: string;
  attachments: any[];
  onConversationCreated?: (convId: string) => void;
}

export function useChatLogic(options: UseChatLogicOptions) {
  const { currentConvId, selectedModel, selectedMode, attachments, onConversationCreated } = options;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  
  const streamingRef = useRef<{ content: string; assistantId: string } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);


  // Save conversation
  const saveConversation = useCallback(async (msgs: Message[], modelId?: string) => {
    if (msgs.length === 0) return;
    const convId = currentConvId;
    const title = msgs[0].content.slice(0, 50) + (msgs[0].content.length > 50 ? '...' : '');
    
    if (convId) {
      // Update existing
      try {
        await fetch(`/api/conversations/${convId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, model_id: modelId }),
        });
      } catch {
        // Silently fail
      }
    } else {
      // Create new
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, messages: msgs, model_id: modelId }),
        });
        if (res.ok) {
          const data = await res.json();
          onConversationCreated?.(data.data?.id);
        }
      } catch {
        // Silently fail
      }
    }
  }, [currentConvId, onConversationCreated]);

  const sendMessage = useCallback(async (content: string, currentAttachments: any[]) => {
    if (!content.trim() && currentAttachments.length === 0) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      createdAt: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setIsThinking(true);
    setToolCalls([]);
    
    // Flush streaming content to state every 50ms
    const flushInterval = setInterval(() => {
      if (streamingRef.current) {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.findIndex((m, i) => i === updated.length - 1 && m.role === 'assistant' && m.id === streamingRef.current!.assistantId);
          if (lastIdx >= 0) {
            updated[lastIdx] = { ...updated[lastIdx], content: streamingRef.current!.content };
          }
          return updated;
        });
      }
    }, 50);
    flushTimerRef.current = flushInterval;
    
    try {
      abortControllerRef.current = new AbortController();
      
      // Build messages for API
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));
      
      // Add system prompt based on mode
      const modePrompts: Record<string, string> = {
        coding: '你是一个专业的编程助手，擅长代码编写、调试和解释。',
        writing: '你是一个专业的文案写手，擅长各种类型的写作任务。',
        analysis: '你是一个专业的数据分析师，擅长分析问题和提供见解。',
        design: '你是一个专业的设计师，擅长创意设计和视觉表达。',
        chat: '',
      };
      
      const systemPrompt = modePrompts[selectedMode] || modePrompts.chat;
      const requestMessages = systemPrompt 
        ? [{ role: 'system' as const, content: systemPrompt }, ...apiMessages]
        : apiMessages;
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages,
          model_id: selectedModel,
          conversation_id: currentConvId || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      setIsThinking(false);
      
      if (!res.ok) throw new Error('Request failed');
      
      // Create assistant message placeholder
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let buffer = '';
      let execLogContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Append EXEC_LOG to last assistant message
              if (execLogContent) {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + '\n\n<!--EXEC_LOG\n' + execLogContent + '\n-->',
                    };
                  }
                  return updated;
                });
              }
              continue;
            }
            
            try {
              const event = JSON.parse(data);
              
              if (event.type === 'tool_call') {
                setToolCalls(prev => [
                  ...prev,
                  {
                    callId: event.callId || `call-${Date.now()}`,
                    toolName: event.toolName,
                    status: 'running',
                  },
                ]);
              } else if (event.type === 'tool_result') {
                const summary = typeof event.result === 'string' 
                  ? event.result.slice(0, 100)
                  : JSON.stringify(event.result).slice(0, 100);
                  
                setToolCalls(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].status === 'running') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      status: event.error ? 'error' : 'done',
                      summary,
                    };
                    // Build exec log
                    execLogContent += `${updated.length}. ${updated[lastIdx].toolName}: ${event.error ? '❌' : '✅'} ${summary}\n`;
                  }
                  return updated;
                });
              } else if (event.type === 'content') {
                // Update streaming buffer
                if (!streamingRef.current || streamingRef.current.assistantId !== assistantId) {
                  streamingRef.current = { content: '', assistantId };
                }
                streamingRef.current.content += event.content || '';
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
      
      // Clear streaming
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      streamingRef.current = null;
      
      // Final update
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].content) {
          updated[lastIdx] = { ...updated[lastIdx], content: '(无内容回复)' };
        }
        return updated;
      });
      
      // Save conversation after completion
      setTimeout(() => {
        saveConversation([...messages, userMessage]);
      }, 100);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Stopped by user
      } else {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '抱歉，发生了错误。请稍后重试。',
          createdAt: new Date(),
        }]);
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      streamingRef.current = null;
    }
  }, [messages, selectedModel, selectedMode, saveConversation]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    streamingRef.current = null;
    setIsLoading(false);
    setIsThinking(false);
  }, []);

  const handleRegenerate = useCallback(async () => {
    // Remove last assistant message and resend
    if (messages.length < 2) return;
    const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx < 0) return;
    
    const lastUserMessage = messages[messages.length - 1 - lastUserIdx];
    const newMessages = messages.slice(0, messages.length - 1 - lastUserIdx);
    
    setMessages(newMessages);
    setTimeout(() => {
      sendMessage(lastUserMessage.content, lastUserMessage.attachments || []);
    }, 50);
  }, [messages, sendMessage]);

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    isThinking,
    toolCalls,
    setToolCalls,
    messagesEndRef,
    sendMessage,
    handleStop,
    handleRegenerate,
  };
}
