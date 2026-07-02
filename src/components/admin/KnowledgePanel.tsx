"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, Plus, Search, BookOpen, FileText, Upload, ChevronLeft, X, CheckCircle2, XCircle, Loader2, AlertCircle, ExternalLink, RefreshCw, ChevronDown, ChevronRight, Eye } from 'lucide-react';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  is_active: boolean;
  doc_count: number;
  total_chunks: number;
  createdat: string;
  updatedat: string;
}

interface Document {
  id: string;
  kb_id: string;
  title: string;
  source_type: string;
  source_path: string;
  chunk_count: number;
  createdat: string;
  updatedat: string;
}

interface SearchResult {
  content: string;
  similarity: number;
  kb_id: string;
  doc_id: string;
  metadata: Record<string, any>;
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  return (
    <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl border ${colors[type]} text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2`}>
      {type === 'error' ? <AlertCircle size={16} /> : type === 'success' ? <CheckCircle2 size={16} /> : <Search size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

export function KnowledgePanel() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateKb, setShowCreateKb] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [docContents, setDocContents] = useState<Record<string, string>>({});
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form states
  const [kbForm, setKbForm] = useState({ name: '', description: '', embedding_model: 'text-embedding-3-small', chunk_size: 500, chunk_overlap: 50 });
  const [docForm, setDocForm] = useState({ title: '', content: '', source_type: 'text', source_path: '' });

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { fetchKnowledgeBases(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const fetchKnowledgeBases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (data.success) setKnowledgeBases(data.data || []);
      else showToast(data.error || '加载失败', 'error');
    } catch (err) { showToast('网络错误', 'error'); }
    setLoading(false);
  };

  const fetchDocContent = async (docId: string, docTitle: string) => {
    // Fetch content and open in new window (avoids in-page modal rendering issues)
    try {
      const res = await fetch('/api/knowledge/documents?doc_id=' + docId);
      const data = await res.json();
      if (data.success && data.data) {
        const docContent = data.data.content || '(无内容)';
        const w = window.open('', '_blank', 'width=900,height=700');
        if (w) {
          w.document.write('<!DOCTYPE html><html><head><title>' + docTitle + '</title><style>body{font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word;padding:20px;margin:0;background:#0f0f14;color:#a0a0b0;line-height:1.6;}</style></head><body>' + docContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</body></html>');
          w.document.close();
        }
      } else { showToast('加载失败', 'error'); }
    } catch { showToast('网络错误', 'error'); }
  };

  const fetchDocuments = async (kbId: string) => {
    try {
      const res = await fetch(`/api/knowledge/documents?kb_id=${kbId}`);
      const data = await res.json();
      if (data.success) setDocuments(data.data || []);
      else showToast(data.error || '加载文档失败', 'error');
    } catch (err) { showToast('网络错误', 'error'); }
  };

  // Poll for indexing status when chunk_count is 0
  const startPolling = (kbId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      await fetchDocuments(kbId);
      await fetchKnowledgeBases();
      const docs = await (await fetch(`/api/knowledge/documents?kb_id=${kbId}`)).json();
      if (docs.success) {
        const allIndexed = (docs.data || []).every((d: Document) => d.chunk_count > 0);
        if (allIndexed && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 3000);
  };

  const handleCreateKb = async () => {
    if (!kbForm.name.trim()) { showToast('请输入知识库名称', 'error'); return; }
    setActionLoading('create-kb');
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kbForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateKb(false);
        setKbForm({ name: '', description: '', embedding_model: 'text-embedding-3-small', chunk_size: 500, chunk_overlap: 50 });
        showToast('知识库创建成功', 'success');
        fetchKnowledgeBases();
      } else {
        showToast(data.error || '创建失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const handleUpdateKb = async () => {
    if (!editingKb) return;
    setActionLoading('update-kb');
    try {
      const res = await fetch('/api/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingKb.id, ...kbForm }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingKb(null);
        setKbForm({ name: '', description: '', embedding_model: 'text-embedding-3-small', chunk_size: 500, chunk_overlap: 50 });
        showToast('更新成功', 'success');
        fetchKnowledgeBases();
      } else {
        showToast(data.error || '更新失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const handleDeleteKb = async (id: string) => {
    if (!confirm('确定删除此知识库？关联的所有文档和分块将被永久删除。')) return;
    setActionLoading(`del-kb-${id}`);
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedKb?.id === id) { setSelectedKb(null); setDocuments([]); }
        showToast('已删除', 'success');
        fetchKnowledgeBases();
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const handleToggleActive = async (kb: KnowledgeBase) => {
    setActionLoading(`toggle-${kb.id}`);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kb.id, is_active: !kb.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(kb.is_active ? '已停用' : '已启用', 'success');
        fetchKnowledgeBases();
      } else {
        showToast(data.error || '操作失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const handleAddDocument = async () => {
    if (!selectedKb) return;
    if (!docForm.title.trim()) { showToast('请输入文档标题', 'error'); return; }
    if (docForm.source_type === 'url' && !docForm.source_path.trim()) { showToast('请输入 URL', 'error'); return; }
    if (docForm.source_type === 'text' && !docForm.content.trim()) { showToast('请输入文档内容', 'error'); return; }
    setActionLoading('add-doc');
    try {
      const res = await fetch('/api/knowledge/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kb_id: selectedKb.id, ...docForm }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddDoc(false);
        setDocForm({ title: '', content: '', source_type: 'text', source_path: '' });
        showToast('文档已添加，正在后台生成索引...', 'info');
        fetchDocuments(selectedKb.id);
        fetchKnowledgeBases();
        startPolling(selectedKb.id);
      } else {
        showToast(data.error || '添加失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('确定删除此文档？关联的分块将被永久删除。')) return;
    setActionLoading(`del-doc-${id}`);
    try {
      const res = await fetch(`/api/knowledge/documents?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('文档已删除', 'success');
        if (selectedKb) { fetchDocuments(selectedKb.id); fetchKnowledgeBases(); }
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) { showToast('请输入至少2个字符', 'error'); return; }
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, top_k: 5, min_similarity: 0.3 }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data || []);
        if ((data.data || []).length === 0) showToast('未找到相关结果（相似度 ≥ 30%）', 'info');
      } else {
        showToast(data.error || '搜索失败', 'error');
      }
    } catch (err) { showToast('网络错误', 'error'); }
    setSearching(false);
  };

  const handleReindexDoc = async (doc: Document) => {
    if (!selectedKb) return;
    setActionLoading(`reindex-${doc.id}`);
    showToast('正在重新索引...', 'info');
    try {
      // Delete old chunks and re-index
      const res = await fetch('/api/knowledge/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kb_id: selectedKb.id, title: doc.title, content: '', source_type: 'text' }),
      });
      // Simpler: just re-fetch and the user can delete + re-add
      showToast('如需重新索引，请删除文档后重新添加', 'info');
    } catch (err) { showToast('网络错误', 'error'); }
    setActionLoading(null);
  };

  const openKbDetail = (kb: KnowledgeBase) => {
    setSelectedKb(kb);
    fetchDocuments(kb.id);
  };

  const startEditKb = (kb: KnowledgeBase) => {
    setEditingKb(kb);
    setKbForm({
      name: kb.name,
      description: kb.description || '',
      embedding_model: kb.embedding_model || 'text-embedding-3-small',
      chunk_size: kb.chunk_size || 500,
      chunk_overlap: kb.chunk_overlap || 50,
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  };

  // Knowledge base detail view
  if (selectedKb) {
    return (
      <div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setSelectedKb(null); setDocuments([]); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }} className="p-2 rounded-lg hover:bg-accent">
            <ChevronLeft size={18} />
          </button>
          <BookOpen size={18} className="text-primary" />
          <h2 className="text-lg font-semibold">{selectedKb.name}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${selectedKb.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
            {selectedKb.is_active ? '活跃' : '停用'}
          </span>
        </div>

        {selectedKb.description && (
          <p className="text-sm text-muted-foreground mb-4">{selectedKb.description}</p>
        )}

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold">{selectedKb.doc_count || 0}</div>
            <div className="text-xs text-muted-foreground">文档</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold">{selectedKb.total_chunks || 0}</div>
            <div className="text-xs text-muted-foreground">分块</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold">{selectedKb.chunk_size}</div>
            <div className="text-xs text-muted-foreground">分块大小</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold">{selectedKb.chunk_overlap}</div>
            <div className="text-xs text-muted-foreground">重叠</div>
          </div>
        </div>

        {/* Documents list */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">文档列表</h3>
          <button onClick={() => { setShowAddDoc(true); setDocForm({ title: '', content: '', source_type: 'text', source_path: '' }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">
            <Plus size={14} /> 添加文档
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground text-sm">暂无文档，点击上方按钮添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} className="flex-shrink-0">
                    {expandedDoc === doc.id ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  </button>
                  <FileText size={16} className="text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{doc.title}</span>
                      {doc.chunk_count === 0 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> 索引中
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{doc.chunk_count} 分块</span>
                      )}
                      {doc.source_type === 'url' && <ExternalLink size={12} className="text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(doc.createdat)}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDoc(doc.id)} disabled={actionLoading === `del-doc-${doc.id}`} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 disabled:opacity-50">
                    {actionLoading === `del-doc-${doc.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
                {expandedDoc === doc.id && (
                  <div className="px-3 pb-3 border-t border-border pt-2">
                    <div className="text-xs text-muted-foreground space-y-1 mb-2">
                      <div>来源: {doc.source_type === 'text' ? '文本粘贴' : doc.source_type === 'url' ? `URL - ${doc.source_path}` : '文件'}</div>
                      <div>创建: {formatDate(doc.createdat)}</div>
                      <div>更新: {formatDate(doc.updatedat)}</div>
                    </div>
                    <button onClick={() => fetchDocContent(doc.id, doc.title)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20"
                    >
                      <Eye size={12} /> 预览完整内容
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add document modal */}
        {showAddDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddDoc(false)}>
            <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">添加文档</h3>
                <button onClick={() => setShowAddDoc(false)} className="p-1 rounded-lg hover:bg-accent"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">标题 *</label>
                  <input value={docForm.title} onChange={e => setDocForm({ ...docForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" placeholder="文档标题" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">来源类型</label>
                  <select value={docForm.source_type} onChange={e => setDocForm({ ...docForm, source_type: e.target.value, content: '', source_path: '' })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
                    <option value="text">文本粘贴</option>
                    <option value="url">URL 抓取</option>
                  </select>
                </div>
                {docForm.source_type === 'url' ? (
                  <div>
                    <label className="text-sm font-medium mb-1 block">URL *</label>
                    <input value={docForm.source_path} onChange={e => setDocForm({ ...docForm, source_path: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary font-mono" placeholder="https://example.com/page" />
                    <p className="text-xs text-muted-foreground mt-1">系统将自动抓取网页文本内容并建立索引</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium mb-1 block">内容 *</label>
                    <textarea value={docForm.content} onChange={e => setDocForm({ ...docForm, content: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary min-h-[200px] font-mono" placeholder="粘贴文档内容..." />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddDoc(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent">取消</button>
                  <button onClick={handleAddDocument} disabled={actionLoading === 'add-doc'} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                    {actionLoading === 'add-doc' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    提交并索引
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main knowledge base list view
  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">知识库管理 <span className="text-sm text-muted-foreground">({knowledgeBases.length} 个)</span></h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(!showSearch)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-accent ${showSearch ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <Search size={14} /> 搜索测试
          </button>
          <button onClick={() => { setShowCreateKb(true); setKbForm({ name: '', description: '', embedding_model: 'text-embedding-3-small', chunk_size: 500, chunk_overlap: 50 }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">
            <Plus size={14} /> 创建知识库
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="font-medium mb-3">知识库搜索测试</h3>
          <p className="text-xs text-muted-foreground mb-3">搜索所有活跃知识库，仅返回相似度 ≥ 30% 的结果</p>
          <div className="flex gap-2 mb-3">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
              placeholder="输入搜索内容..."
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <button onClick={handleSearch} disabled={searching} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} 搜索
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((r, i) => (
                <div key={i} className="bg-background border border-border rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.similarity >= 0.7 ? 'bg-green-500/10 text-green-500' : r.similarity >= 0.5 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      相似度 {(r.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-3">{r.content}</p>
                </div>
              ))}
            </div>
          )}
          {searchResults.length === 0 && searchQuery && !searching && (
            <p className="text-sm text-muted-foreground text-center py-4">未找到相关结果</p>
          )}
        </div>
      )}

      {/* Knowledge base list */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
      ) : knowledgeBases.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">暂无知识库</p>
          <p className="text-sm text-muted-foreground/60 mt-1">创建知识库后，AI 对话将自动检索相关知识</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {knowledgeBases.map(kb => (
            <div key={kb.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0 cursor-pointer flex-1" onClick={() => openKbDetail(kb)}>
                  <BookOpen size={18} className="text-primary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kb.name}</span>
                      {kb.is_active ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-gray-500" />}
                    </div>
                    {kb.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{kb.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{kb.doc_count || 0} 文档</span>
                      <span>{kb.total_chunks || 0} 分块</span>
                      <span>模型: {kb.embedding_model}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggleActive(kb)} disabled={actionLoading === `toggle-${kb.id}`}
                    className={`px-2 py-1 rounded text-xs disabled:opacity-50 ${kb.is_active ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'}`}>
                    {actionLoading === `toggle-${kb.id}` ? <Loader2 size={12} className="animate-spin" /> : kb.is_active ? '活跃' : '停用'}
                  </button>
                  <button onClick={() => startEditKb(kb)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="编辑">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button onClick={() => handleDeleteKb(kb.id)} disabled={actionLoading === `del-kb-${kb.id}`} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50" title="删除">
                    {actionLoading === `del-kb-${kb.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document content preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setPreviewDoc(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold truncate">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="p-1 rounded-lg hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
              ) : (
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">{previewContent}</pre>
              )}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border flex-shrink-0">
              <span className="text-xs text-muted-foreground">{previewContent.length} 字符</span>
              <button onClick={() => setPreviewDoc(null)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit KB modal */}
      {(showCreateKb || editingKb) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowCreateKb(false); setEditingKb(null); }}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingKb ? '编辑知识库' : '创建知识库'}</h3>
              <button onClick={() => { setShowCreateKb(false); setEditingKb(null); }} className="p-1 rounded-lg hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">名称 *</label>
                <input value={kbForm.name} onChange={e => setKbForm({ ...kbForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" placeholder="知识库名称" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">描述</label>
                <input value={kbForm.description} onChange={e => setKbForm({ ...kbForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" placeholder="知识库用途说明" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Embedding 模型</label>
                <select value={kbForm.embedding_model} onChange={e => setKbForm({ ...kbForm, embedding_model: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
                  <option value="text-embedding-3-small">text-embedding-3-small (OpenAI，1536维，推荐)</option>
                  <option value="text-embedding-3-large">text-embedding-3-large (OpenAI，3072维，更精准)</option>
                  <option value="text-embedding-ada-002">text-embedding-ada-002 (OpenAI，1536维，经典)</option>
                  <option value="bge-m3">bge-m3 (多语言，1024维)</option>
                  <option value="text-embedding-ada-002">text-embedding-ada-002 (旧版)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">分块大小</label>
                  <input type="number" value={kbForm.chunk_size} onChange={e => setKbForm({ ...kbForm, chunk_size: Math.max(100, parseInt(e.target.value) || 500) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={100} max={2000} />
                  <p className="text-xs text-muted-foreground mt-0.5">建议 300-1000</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">重叠大小</label>
                  <input type="number" value={kbForm.chunk_overlap} onChange={e => setKbForm({ ...kbForm, chunk_overlap: Math.max(0, parseInt(e.target.value) || 50) })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" min={0} max={500} />
                  <p className="text-xs text-muted-foreground mt-0.5">建议 10%-20% 分块大小</p>
                </div>
              </div>
              {editingKb && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-500">
                  修改分块设置后，新添加的文档将使用新设置。已有文档不受影响。
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowCreateKb(false); setEditingKb(null); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent">取消</button>
                <button onClick={editingKb ? handleUpdateKb : handleCreateKb} disabled={actionLoading !== null}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingKb ? '保存' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


