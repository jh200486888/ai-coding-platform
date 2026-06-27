"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ChevronLeft, Clock, Pencil, X, Check } from 'lucide-react';

interface ConversationItem {
  id: string;
  title: string;
  model_id?: string;
  created_at: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationItem[];
  currentConvId: string | null;
  onSelectConversation: (convId: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (convId: string, e: React.MouseEvent) => void;
  renamingConvId: string | null;
  renameTitle: string;
  onStartRename: (convId: string, currentTitle: string, e: React.MouseEvent) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onRenameChange: (title: string) => void;
}

export function ConversationSidebar({
  isOpen,
  onClose,
  conversations,
  currentConvId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  renamingConvId,
  renameTitle,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onRenameChange,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Sort by updated_at descending
  const sortedConversations = [...filteredConversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed md:relative inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col safe-area-pb">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">对话历史</span>
          <button
            onClick={onNewChat}
            className="p-1.5 rounded-lg hover:bg-muted text-primary"
            title="新建对话"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {sortedConversations.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
            </div>
          ) : (
            sortedConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => !renamingConvId && onSelectConversation(conv.id)}
                className={`group relative px-3 py-3 cursor-pointer transition-colors border-b border-border/50 ${
                  currentConvId === conv.id
                    ? 'bg-primary/10 border-l-2 border-l-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                {renamingConvId === conv.id ? (
                  // Rename mode
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={renameTitle}
                      onChange={e => onRenameChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') onConfirmRename();
                        if (e.key === 'Escape') onCancelRename();
                      }}
                      className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button onClick={onConfirmRename} className="p-1 text-primary hover:bg-primary/10 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelRename} className="p-1 text-muted-foreground hover:bg-muted rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Normal mode
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {conv.title || '未命名对话'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{(() => { const d = new Date(conv.updated_at); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}</span>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={e => onStartRename(conv.id, conv.title, e)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="重命名"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => onDeleteConversation(conv.id, e)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
