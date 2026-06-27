import { useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import { toast } from 'sonner';

// ============ Helper: 从 UIMessage 提取纯文本 ============
function extractTextContent(msg: any): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('');
  }
  return '';
}

// ============ DB 消息 → UIMessage 格式转换 ============
function convertDBMessages(dbMsgs: any[]): UIMessage[] {
  return dbMsgs
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => {
      const content: string = m.content || '';
      const parts: any[] = [];

      let toolCalls: any[] = [];
      let displayContent = content;

      // 解析 EXEC_LOG 中的工具调用记录
      if (m.role === 'assistant' && content.includes('<!--EXEC_LOG')) {
        const logMatch = content.match(/<!--EXEC_LOG\n([\s\S]*?)\n-->/);
        if (logMatch) {
          const lines = logMatch[1].split('\n').filter(Boolean);
          toolCalls = lines.map((line: string) => {
            const match = line.match(/^\d+\.\s+(.+?):\s+(✅|❌)\s*(.*)/);
            if (match) {
              return {
                toolName: match[1],
                status: match[2] === '✅' ? 'done' : 'error',
                summary: match[3],
              };
            }
            return null;
          }).filter(Boolean);
          displayContent = content.replace(/\n\n<!--EXEC_LOG\n[\s\S]*?\n-->/, '');
        }
      }

      // 构建 UIMessage parts
      if (displayContent) {
        parts.push({ type: 'text', text: displayContent });
      }
      for (const tc of toolCalls) {
        parts.push({
          type: `tool-${tc.toolName}`,
          toolCallId: `hist-${tc.toolName}-${Math.random().toString(36).slice(2, 8)}`,
          state: tc.status === 'error' ? 'output-error' : 'output-available',
          input: {},
          ...(tc.status !== 'error' && { output: tc.summary }),
          ...(tc.status === 'error' && { errorText: tc.summary }),
        });
      }

      return {
        id: m.id || `msg-${Math.random().toString(36).slice(2)}`,
        role: m.role as 'user' | 'assistant',
        parts: parts.length > 0 ? parts : [{ type: 'text' as const, text: '' }],
        createdAt: new Date(m.created_at || m.createdAt || Date.now()),
      } as UIMessage;
    });
}

// ============ 主 Hook：基于 AI SDK useChat ============
export function useChatLogic(options: {
  currentConvId: string | null;
  selectedModel: string;
  selectedMode: string;
  enableSearch?: boolean;
  attachments: any[];
  onConversationCreated: (convId: string) => void;
}) {
  const { currentConvId, selectedModel, selectedMode, enableSearch = true, onConversationCreated } = options;
  const currentConvIdRef = useRef(currentConvId);
  currentConvIdRef.current = currentConvId;

  const chat = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messageMetadataSchema: z.object({ conversationId: z.string().optional() }).optional(),
    async onFinish({ message }) {
      // 从 message metadata 提取 conversation_id
      const convId = (message.metadata as any)?.conversationId;
      if (convId) onConversationCreated(convId);
      // Note: Assistant messages are already saved by server-side onEnd callback
      // No need to save again from client side
    },
    onError(error) {
      toast.error('AI 响应出错，请重试');
      console.error('[useChatLogic] error:', error);
    },
  });

  // 发送消息
  const sendMessage = useCallback(async (content: string, attachments: any[] = []) => {
    // Build attachment markers in message text for server-side processing
    let messageText = content;
    const attachmentData: any[] = [];
    for (const att of attachments) {
      if (att.type === 'image') {
        messageText += `
[image:${att.url}]`;
        attachmentData.push({ name: att.name, type: 'image', url: att.url });
      } else if (att.content) {
        // Code/document files with text content
        messageText += `
[file:${att.name}]:
${att.content.slice(0, 8000)}`;
        attachmentData.push({ name: att.name, type: att.type, content: att.content?.slice(0, 8000) });
      } else {
        messageText += `
[file:${att.url}]`;
        attachmentData.push({ name: att.name, type: att.type, url: att.url });
      }
    }

    chat.sendMessage(
      { text: messageText },
      {
        body: {
          conversation_id: currentConvIdRef.current || undefined,
          mode: selectedMode,
          model_id: selectedModel,
          enable_search: enableSearch,
          attachments: attachmentData,
        },
      }
    );
  }, [chat, selectedMode, selectedModel, enableSearch]);


  // 加载历史对话
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.messages) {
          const uiMessages = convertDBMessages(data.data.messages);
          chat.setMessages(uiMessages);
        } else {
          chat.setMessages([]);
        }
      }
    } catch {}
  }, [chat.setMessages]);

  // 新建对话
  const startNewChat = useCallback(() => {
    chat.setMessages([]);
  }, [chat.setMessages]);

  // 停止生成
  const handleStop = useCallback(() => {
    chat.stop();
  }, [chat.stop]);

  // Convert UIMessage[] to legacy Message[] format for existing components
  const adaptedMessages = chat.messages.map((msg: any) => {
    const textContent = extractTextContent(msg);
    return {
      id: msg.id,
      role: msg.role,
      content: textContent,
      createdAt: msg.createdAt || new Date(),
      attachments: [],
      // 保留 parts 用于工具调用显示
      parts: msg.parts,
    } as any;
  });

  return {
    messages: adaptedMessages,
    setMessages: chat.setMessages,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isThinking: chat.status === 'submitted',
    messagesEndRef: { current: null } as React.RefObject<HTMLDivElement | null>,
    sendMessage,
    handleStop,
    loadConversation,
    startNewChat,
    chat,
  };
}

