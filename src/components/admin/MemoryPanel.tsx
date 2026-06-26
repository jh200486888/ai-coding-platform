"use client";
import { useState, useEffect } from 'react';
import { Trash2, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface MemoryItem {
  id: string;
  category: string;
  content: string;
  tags: string;
  importance: number;
  keywords: string;
  createdAt: string;
  updatedAt: string;
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MemoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  useEffect(() => { fetchMemories(); }, [page, search]);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
      if (search) params.set('q', search);
      const res = await fetch(`/api/admin/memories?${params}`);
      const data = await res.json();
      if (data.success) {
        setMemories(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此记忆？')) return;
    await fetch('/api/admin/memories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchMemories();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">记忆管理 <span className="text-sm text-muted-foreground">({total} 条)</span></h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary w-64"
              placeholder="搜索记忆..." />
          </div>
        </div>
      </div>

      {selected && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">记忆详情</h3>
            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">关闭</button>
          </div>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">ID:</span> {selected.id}</div>
            <div><span className="text-muted-foreground">分类:</span> {selected.category}</div>
            <div><span className="text-muted-foreground">重要度:</span> {selected.importance}/5</div>
            <div><span className="text-muted-foreground">标签:</span> {selected.tags || '无'}</div>
            <div><span className="text-muted-foreground">关键词:</span> {selected.keywords || '无'}</div>
            <div><span className="text-muted-foreground">内容:</span></div>
            <div className="bg-background p-3 rounded-lg">{selected.content}</div>
            <div className="text-xs text-muted-foreground">创建: {selected.createdAt} | 更新: {selected.updatedAt}</div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {memories.map(m => (
          <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">{m.category}</span>
                <span className="text-xs text-muted-foreground">重要度: {m.importance}/5</span>
              </div>
              <p className="text-sm truncate">{m.content}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={() => setSelected(m)} className="p-2 rounded-lg hover:bg-accent"><Eye size={16} /></button>
              <button onClick={() => handleDelete(m.id)} className="p-2 rounded-lg hover:bg-accent text-red-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {memories.length === 0 && !loading && <p className="text-center text-muted-foreground py-8">暂无记忆</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-accent disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-accent disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
