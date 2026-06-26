"use client";

import { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, ChevronLeft, ChevronRight, Star, Brain, X, Eye } from 'lucide-react';

interface UserMemory {
  id: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string;
  importance: number;
  keywords: string;
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<UserMemory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 20;

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
        ...(searchQuery && { q: searchQuery }),
      });
      const res = await fetch(`/api/admin/memories?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleSearch = () => {
    setPage(1);
    fetchMemories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记忆吗？')) return;
    try {
      const res = await fetch('/api/admin/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchMemories();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记忆吗？`)) return;
    try {
      const res = await fetch('/api/admin/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchMemories();
      }
    } catch (err) {
      console.error('Failed to batch delete:', err);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === memories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memories.map(m => m.id)));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const renderStars = (count: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= count ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`}
          />
        ))}
      </div>
    );
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5" />
          记忆管理
        </h2>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            删除选中 ({selectedIds.size})
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索内容、分类、标签、关键词..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
        >
          搜索
        </button>
      </div>

      <div className="text-sm text-muted-foreground">
        共 {total} 条记忆
        {selectedIds.size > 0 && `，已选中 ${selectedIds.size} 条`}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{searchQuery ? '未找到匹配的记录' : '暂无记忆数据'}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={selectedIds.size === memories.length && memories.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded"
              />
              <span className="flex-1">全选</span>
              <span className="w-20">分类</span>
              <span className="w-24">重要性</span>
              <span className="w-40">时间</span>
              <span className="w-24">操作</span>
            </div>
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(memory.id)}
                  onChange={() => toggleSelect(memory.id)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm cursor-pointer hover:text-primary"
                    onClick={() => setSelectedMemory(memory)}
                  >
                    {truncateContent(memory.content)}
                  </div>
                  {memory.tags && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {memory.tags.split(',').filter(Boolean).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-20 text-sm text-muted-foreground truncate">
                  {memory.category}
                </div>
                <div className="w-24">
                  {renderStars(memory.importance || 3)}
                </div>
                <div className="w-40 text-xs text-muted-foreground">
                  {new Date(memory.createdAt).toLocaleString('zh-CN')}
                </div>
                <div className="w-24 flex items-center gap-1">
                  <button
                    onClick={() => setSelectedMemory(memory)}
                    className="p-1.5 text-muted-foreground hover:bg-accent rounded transition-colors"
                    title="查看"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-card border border-border text-sm disabled:opacity-50 hover:bg-accent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-card border border-border text-sm disabled:opacity-50 hover:bg-accent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {selectedMemory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedMemory(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">记忆详情</h3>
              <button
                onClick={() => setSelectedMemory(null)}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">分类</div>
                  <div className="font-medium">{selectedMemory.category}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">重要性</div>
                  <div>{renderStars(selectedMemory.importance || 3)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">创建时间</div>
                  <div className="text-sm">{new Date(selectedMemory.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              </div>
              {selectedMemory.tags && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">标签</div>
                  <div className="flex gap-1 flex-wrap">
                    {selectedMemory.tags.split(',').filter(Boolean).map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-muted rounded text-sm">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedMemory.keywords && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">关键词</div>
                  <div className="text-sm">{selectedMemory.keywords}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground mb-1">内容</div>
                <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {selectedMemory.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
