'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, MessageSquare, BookOpen, X } from 'lucide-react';

export interface MentionItem {
  id: string;
  type: 'file' | 'conversation' | 'knowledge';
  label: string;
  content?: string;
  path?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  conversations?: Array<{ id: string; title: string }>;
  projectId?: string;
  onMentionsChange?: (mentions: MentionItem[]) => void;
}

type TabType = 'file' | 'conversation' | 'knowledge';

interface SearchResult {
  id: string;
  label: string;
  type: TabType;
  path?: string;
}

export function MentionInput({
  value,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  disabled,
  className,
  textareaRef: externalRef,
  conversations = [],
  projectId,
  onMentionsChange,
}: MentionInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;
  const popoverRef = useRef<HTMLDivElement>(null);

  const [showPopover, setShowPopover] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('file');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMentions, setActiveMentions] = useState<MentionItem[]>([]);

  // Fetch file list
  const fetchFiles = useCallback(async (query: string) => {
    if (!projectId) return [];
    try {
      const res = await fetch(`/api/workspace/files?projectId=${projectId}`);
      if (!res.ok) return [];
      const files = await res.json();
      return (files as any[])
        .filter(f => !query || f.name.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map(f => ({ id: f.id, label: f.name || f.path.split('/').pop(), type: 'file' as const, path: f.path }));
    } catch {
      return [];
    }
  }, [projectId]);

  // Fetch knowledge bases
  const fetchKnowledge = useCallback(async (query: string) => {
    try {
      const res = await fetch('/api/knowledge');
      if (!res.ok) return [];
      const data = await res.json();
      const kbs = data.data || [];
      return kbs
        .filter((kb: any) => !query || kb.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map((kb: any) => ({ id: kb.id, label: kb.name, type: 'knowledge' as const }));
    } catch {
      return [];
    }
  }, []);

  // Get conversation results
  const getConversationResults = useCallback((query: string) => {
    return conversations
      .filter(c => !query || c.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10)
      .map(c => ({ id: c.id, label: c.title, type: 'conversation' as const }));
  }, [conversations]);

  // Load results when tab or query changes
  useEffect(() => {
    if (!showPopover) return;
    setLoading(true);
    setSelectedIndex(0);

    const load = async () => {
      let r: SearchResult[] = [];
      if (activeTab === 'file') {
        r = await fetchFiles(searchQuery);
      } else if (activeTab === 'conversation') {
        r = getConversationResults(searchQuery);
      } else {
        r = await fetchKnowledge(searchQuery);
      }
      setResults(r);
      setLoading(false);
    };
    load();
  }, [showPopover, activeTab, searchQuery, fetchFiles, getConversationResults, fetchKnowledge]);

  // Detect @ trigger
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Find the last @ that starts a mention (not inside a completed mention)
    const atMatch = textBeforeCursor.match(/@([^@\n]*?)$/);
    if (atMatch) {
      const atPos = cursorPos - atMatch[0].length;
      // Check if this @ is not already part of a completed mention
      const beforeAt = textBeforeCursor.slice(0, atPos);
      if (!beforeAt.endsWith('](')) {
        setMentionStart(atPos);
        setSearchQuery(atMatch[1]);
        setShowPopover(true);
        return;
      }
    }
    setShowPopover(false);
  }, [onChange]);

  // Insert mention
  const insertMention = useCallback((item: SearchResult) => {
    if (mentionStart < 0) return;

    const mentionTag = `@[${item.label}](${item.type}:${item.id})`;
    const before = value.slice(0, mentionStart);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const after = value.slice(cursorPos);
    const newValue = before + mentionTag + ' ' + after;

    onChange(newValue);
    setShowPopover(false);

    // Track active mention
    const mention: MentionItem = {
      id: item.id,
      type: item.type,
      label: item.label,
      path: item.path,
    };
    const updatedMentions = [...activeMentions.filter(m => m.id !== item.id), mention];
    setActiveMentions(updatedMentions);
    onMentionsChange?.(updatedMentions);

    // Set cursor after the inserted mention
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = before.length + mentionTag.length + 1;
        ta.selectionStart = pos;
        ta.selectionEnd = pos;
        ta.focus();
      }
    }, 0);
  }, [mentionStart, value, onChange, textareaRef, activeMentions, onMentionsChange]);

  // Handle keyboard navigation in popover
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopover && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(results[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowPopover(false);
        return;
      }
    }
    onKeyDown?.(e);
  }, [showPopover, results, selectedIndex, insertMention, onKeyDown]);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'file', label: '文件', icon: FileText },
    { id: 'conversation', label: '对话', icon: MessageSquare },
    { id: 'knowledge', label: '知识库', icon: BookOpen },
  ];

  return (
    <div className="relative flex-1 min-w-0">
      {/* Active mention badges */}
      {activeMentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {activeMentions.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md bg-primary/10 text-primary">
              {m.type === 'file' ? <FileText className="w-3 h-3" /> : m.type === 'conversation' ? <MessageSquare className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
              {m.label}
              <button
                onClick={() => {
                  const updated = activeMentions.filter(x => x.id !== m.id);
                  setActiveMentions(updated);
                  onMentionsChange?.(updated);
                  // Remove the mention tag from text
                  const tagPattern = `@[${m.label}](${m.type}:${m.id})`;
                  onChange(value.replace(tagPattern, ''));
                }}
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        rows={1}
        style={{ maxHeight: 160 }}
      />

      {/* Mention popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 mb-1 w-64 max-h-60 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50"
        >
          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs transition-colors ${
                    activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-44">
            {loading ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">加载中...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                {activeTab === 'file' && !projectId ? '当前无活跃项目' : '无匹配结果'}
              </div>
            ) : (
              results.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => insertMention(item)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                    idx === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  {item.type === 'file' ? <FileText className="w-3.5 h-3.5 shrink-0" /> :
                   item.type === 'conversation' ? <MessageSquare className="w-3.5 h-3.5 shrink-0" /> :
                   <BookOpen className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                  {item.path && <span className="text-muted-foreground truncate ml-auto text-[10px]">{item.path}</span>}
                </button>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1 border-t border-border text-[10px] text-muted-foreground">
            输入关键词搜索, Enter 选择, Esc 关闭
          </div>
        </div>
      )}
    </div>
  );
}

// Utility: parse mention tags from text and return cleaned text + mentions
export function parseMentions(text: string): { cleanText: string; mentions: MentionItem[] } {
  const mentionRegex = /@\[([^\]]+)\]\((file|conversation|knowledge):([^)]+)\)/g;
  const mentions: MentionItem[] = [];
  const cleanText = text.replace(mentionRegex, (match, label, type, id) => {
    mentions.push({ id, type: type as MentionItem['type'], label });
    return `@${label}`;
  });
  return { cleanText, mentions };
}
