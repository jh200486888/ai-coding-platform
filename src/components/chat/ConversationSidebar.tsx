"use client";

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, ChevronLeft, Clock, Pencil, X, Check, LogOut, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';

interface ConversationItem {
  id: string;
  title: string;
  model_id?: string;
  created_at: string;
  updated_at: string;
  // Search result extra fields
  snippet?: string;
  matchType?: 'title' | 'content';
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
  const [searchResults, setSearchResults] = useState<ConversationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { user: authUser, logout: authLogout } = useAuth();

  // Full-text search via API when logged in
  useEffect(() => {
    if (!searchQuery.trim() || !authUser) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(searchQuery.trim())}&limit=30`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults((data.results || []).map((r: any) => ({
            id: r.id,
            title: r.title,
            model_id: r.model_id,
            created_at: r.created_at,
            updated_at: r.updated_at,
            snippet: r.snippet,
            matchType: r.match_type,
          })));
        }
      } catch {
        // Fallback to local filter
        const q = searchQuery.toLowerCase();
        setSearchResults(
          conversations.filter(c => c.title.toLowerCase().includes(q))
        );
      }
      setIsSearching(false);
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [searchQuery, authUser]);

  const handleLogout = async () => {
    await authLogout();
  };

  // Use search results when searching, otherwise use conversations list
  const isSearchMode = searchQuery.trim().length > 0 && !!authUser;
  const displayConversations = isSearchMode
    ? searchResults
    : (searchQuery.trim()
        ? conversations.filter(c =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : conversations);

  // Sort by updated_at descending
  const sortedConversations = [...displayConversations].sort(
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={authUser ? "搜索对话内容..." : "搜索标题..."}
              className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {isSearchMode && searchResults.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1 px-1">
              找到 {searchResults.length} 条结果
            </div>
          )}
        </div>
        
        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {sortedConversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors ${
                currentConvId === conv.id
                  ? 'bg-primary/15 text-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{conv.title}</div>
                {conv.snippet && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.snippet}
                  </div>
                )}
                <div className="text-xs text-muted-foreground/50 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(conv.updated_at).toLocaleDateString()}
                  {conv.matchType === 'content' && (
                    <span className="text-primary/70 ml-1">内容匹配</span>
                  )}
                </div>
              </div>
              
              {/* Rename mode */}
              {renamingConvId === conv.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    value={renameTitle}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onConfirmRename();
                      if (e.key === 'Escape') onCancelRename();
                    }}
                    className="w-28 bg-input border border-border rounded px-1 py-0.5 text-xs"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onConfirmRename(); }}
                    className="p-0.5 text-green-400 hover:text-green-300"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelRename(); }}
                    className="p-0.5 text-red-400 hover:text-red-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => onStartRename(conv.id, conv.title, e)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    title="重命名"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => onDeleteConversation(conv.id, e)}
                    className="p-1 rounded hover:bg-muted text-red-400"
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {sortedConversations.length === 0 && searchQuery.trim() && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isSearching ? '搜索中...' : '没有找到匹配的对话'}
            </div>
          )}
        </div>
        
        {/* User info / login */}
        <div className="border-t border-border p-3">
          {authUser ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{authUser.name || authUser.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <User className="w-4 h-4" />
              登录保存对话
            </a>
          )}
        </div>
      </div>
    </>
  );
}
