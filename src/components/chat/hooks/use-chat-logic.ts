import { useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import { toast } from 'sonner';

// ============ Helper: 从 UIMessage 提取纯文本 ============
function extractTextContent(msg: any): string {
  if (!msg) return '';
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
  return (dbMsgs || [])
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

      // Build reasoning from DB field
      const dbReasoning = (m as any).reasoning;
      const reasoningParts = dbReasoning ? [{ type: 'reasoning' as const, text: dbReasoning }] : undefined;

      return {
        id: m.id || `msg-${Math.random().toString(36).slice(2)}`,
        role: m.role as 'user' | 'assistant',
        parts: parts.length > 0 ? parts : [{ type: 'text' as const, text: '' }],
        createdAt: new Date(m.created_at || m.createdAt || Date.now()),
        ...(reasoningParts ? { reasoning: reasoningParts } : {}),
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
    // sendAutomaticallyWhen removed - AI SDK v7 had null.length bug
    // Safe replacement: watch for approval responses and auto-resume
    async onFinish({ message }) {
      const convId = (message.metadata as any)?.conversationId;
      if (convId) onConversationCreated(convId);
    },
    onError(error) {
      toast.error('AI 响应出错，请重试');
      console.error('[useChatLogic] error:', error);
    },
  });

  // 发送消息 - AI SDK 原生多模态 files
  const sendMessage = useCallback(async (content: string, attachments: any[] = []) => {
    // Build AI SDK native FileUIPart[] for images
    const imageFiles: Array<{ type: 'file'; mediaType: string; url: string }> = [];
    const fileTextParts: string[] = [];

    for (const att of attachments) {
      if (att.type === 'image' && att.url) {
        // AI SDK native: FileUIPart with data URL
        const dataUrl = att.url;
        const mediaTypeMatch = dataUrl.match(/^data:(image\/[^;]+);/);
        const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/png';
        imageFiles.push({ type: 'file', mediaType, url: dataUrl });
      } else if (att.content || att.url) {
        // 文件附件：只在消息中显示文件名，内容通过body.attachments传递
        fileTextParts.push(`[附件: ${att.name}]`);
      }
    }

    // Append file text to message content
    let messageText = content;
    if (fileTextParts.length > 0) {
      messageText += '\n' + fileTextParts.join('\n');
    }

    chat.sendMessage(
      {
        text: messageText,
        files: imageFiles.length > 0 ? imageFiles : undefined,
      },
      {
        body: {
          conversation_id: currentConvIdRef.current || undefined,
          mode: selectedMode,
          model_id: selectedModel,
          enable_search: enableSearch,
          attachments: attachments.map(att => ({
            name: att.name,
            type: att.type,
            ...(att.url ? { url: att.url } : {}),
            ...(att.content ? { content: att.content?.slice(0, 8000) } : {}),
          })),
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
      parts: msg.parts,
      // Pass through reasoning content for thinking mode display
      reasoning: msg.reasoning || undefined,
    } as any;
  });

  // Safe auto-resume: when tool approval is responded, auto-send to continue
  const prevApprovalCount = useRef(0);
  useEffect(() => {
    if (chat.status !== 'streaming' && chat.status !== 'submitted') return;
    const msgs = chat.messages || [];
    if (!msgs.length) return;
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || !Array.isArray(lastMsg.parts)) return;
    const approvedParts = lastMsg.parts.filter((p: any) =>
      p.type === 'tool-invocation' && (p.state === 'approval-responded' || p.state === 'output-denied')
    );
    if (approvedParts.length > prevApprovalCount.current) {
      prevApprovalCount.current = approvedParts.length;
      // Small delay to let SDK process the approval response
      setTimeout(() => {
        if (chat.status !== 'streaming') {
          chat.sendMessage({ text: '' });
        }
      }, 500);
    }
  }, [chat.messages, chat.status]);

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
    addToolApprovalResponse: chat.addToolApprovalResponse,
    chat,
  };
}
