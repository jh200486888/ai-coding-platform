import { useState, useCallback } from 'react';

export interface ConversationItem {
  id: string;
  title: string;
  model_id?: string;
  created_at: string;
  updated_at: string;
}

interface UseConversationsOptions {
  onConversationLoaded?: (convId: string) => void;
}

export function useConversations(options: UseConversationsOptions = {}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const startRename = useCallback((convId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConvId(convId);
    setRenameTitle(currentTitle);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renamingConvId || !renameTitle.trim()) return;
    try {
      await fetch(`/api/conversations/${renamingConvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      setRenamingConvId(null);
      setRenameTitle('');
      fetchConversations();
    } catch {
      setRenamingConvId(null);
    }
  }, [renamingConvId, renameTitle, fetchConversations]);

  const cancelRename = useCallback(() => {
    setRenamingConvId(null);
    setRenameTitle('');
  }, []);

  const loadConversation = useCallback(async (convId: string, setMessages: (msgs: any[]) => void, setToolCalls?: (calls: any[]) => void) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        const convData = data.data;
        if (convData?.messages) {
          const loadedMessages = convData.messages.map((m: any) => {
            let msgContent = m.content || '';
            // Parse EXEC_LOG to restore tool call badges
            if (m.role === 'assistant' && msgContent.includes('<!--EXEC_LOG')) {
              const logMatch = msgContent.match(/<!--EXEC_LOG\n([\s\S]*?)\n-->/);
              if (logMatch) {
                const logContent = logMatch[1];
                const restoredCalls: any[] = [];
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
                if (restoredCalls.length > 0 && setToolCalls) {
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
        options.onConversationLoaded?.(convId);
        return convData;
      }
    } catch {
      // Silently fail
    }
    return null;
  }, [options.onConversationLoaded]);

  const deleteConversation = useCallback(async (convId: string, onNewChat: () => void) => {
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      if (currentConvId === convId) {
        onNewChat();
      }
      fetchConversations();
    } catch {
      // Silently fail
    }
  }, [currentConvId, fetchConversations]);

  const startNewChat = useCallback((setMessages: (msgs: any[]) => void, setToolCalls?: (calls: any[]) => void) => {
    setMessages([]);
    setCurrentConvId(null);
    if (setToolCalls) setToolCalls([]);
  }, []);

  const createConversation = useCallback(async (title: string, modelId?: string, messages?: any[]) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, model_id: modelId, messages }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchConversations();
        return data.data;
      }
    } catch {
      // Silently fail
    }
    return null;
  }, [fetchConversations]);

  return {
    conversations,
    currentConvId,
    setCurrentConvId,
    renamingConvId,
    renameTitle,
    setRenameTitle,
    fetchConversations,
    loadConversation,
    startNewChat,
    deleteConversation,
    startRename,
    confirmRename,
    cancelRename,
    createConversation,
  };
}
