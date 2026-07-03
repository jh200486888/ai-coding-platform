// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Shield, AlertTriangle, CheckCircle, FileText, Terminal, Upload } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  file_create: '创建文件', file_edit: '编辑文件', file_delete: '删除文件',
  command_exec: '执行命令', ssh_exec: 'SSH执行', ssh_write: 'SSH写入',
  deploy: '部署', build: '构建',
  db_query: '数据库查询', db_write: '数据库写入',
  model_switch: '模型切换', config_change: '配置变更',
  sub_agent_delegate: '委派子代理', sub_agent_message: '子代理消息',
};

export function AuditLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [convFilter, setConvFilter] = useState('');
  const [conversations, setConversations] = useState<{id: string; title: string}[]>([]);
  const limit = 30;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set('action', actionFilter);
      if (convFilter) params.set('conversation_id', convFilter);
      const res = await fetch('/api/admin/audit-logs?' + params);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
    setLoading(false);
  };

  // Fetch conversations for the dropdown
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/admin/conversations?limit=100');
      const data = await res.json();
      if (data.success || data.data) {
        const convs = (data.data || data.conversations || []).map((c: any) => ({
          id: c.id,
          title: (c.title || '无标题').substring(0, 40),
        }));
        setConversations(convs);
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, actionFilter, convFilter]);
  useEffect(() => { fetchConversations(); }, []);

  const totalPages = Math.ceil(total / limit);
  const actionTypes = Object.entries(ACTION_LABELS);

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleString('zh-CN'); } catch { return ts; }
  };

  // Find conversation title by ID
  const getConvTitle = (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    return conv ? conv.title : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield size={20} /> 审计日志
        </h2>
        <button onClick={fetchLogs} disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm">
          <option value="">全部操作类型</option>
          {actionTypes.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select value={convFilter} onChange={e => { setConvFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm min-w-[250px]">
          <option value="">全部会话</option>
          {conversations.map(c => (
            <option key={c.id} value={c.id}>{c.title} ({c.id.substring(0, 8)}...)</option>
          ))}
        </select>
        <button onClick={() => { setPage(1); setTimeout(() => fetchLogs(), 0); }}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">
          搜索
        </button>
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        共 {total} 条记录
        {actionFilter && <span> | 操作: {ACTION_LABELS[actionFilter] || actionFilter}</span>}
        {convFilter && <span> | 会话: {getConvTitle(convFilter) || convFilter.substring(0, 8)}</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">时间</th>
              <th className="text-left p-2 font-medium">操作</th>
              <th className="text-left p-2 font-medium">会话</th>
              <th className="text-left p-2 font-medium">详情</th>
              <th className="text-left p-2 font-medium">结果</th>
              <th className="text-left p-2 font-medium">耗时</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">暂无审计记录（执行构建、部署、命令等操作后会自动记录）</td></tr>
            ) : logs.map((log: any, i: number) => {
              const convTitle = log.conversation_id ? getConvTitle(log.conversation_id) : null;
              return (
                <tr key={log.id || i} className="border-t border-border hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap text-xs">{formatTime(log.created_at)}</td>
                  <td className="p-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      log.success !== false ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="p-2 max-w-[180px] text-xs" title={log.conversation_id || ''}>
                    {convTitle 
                      ? <span className="truncate block">{convTitle}</span>
                      : <span className="text-muted-foreground font-mono">{log.conversation_id ? log.conversation_id.substring(0, 8) + '...' : '-'}</span>
                    }
                  </td>
                  <td className="p-2 max-w-[300px] truncate text-xs text-muted-foreground font-mono" title={log.detail}>
                    {log.detail ? log.detail.substring(0, 80) : '-'}
                  </td>
                  <td className="p-2">
                    {log.success !== false
                      ? <CheckCircle size={14} className="text-green-500" />
                      : <AlertTriangle size={14} className="text-red-500" />}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {log.duration_ms ? (log.duration_ms / 1000).toFixed(1) + 's' : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 rounded border border-border text-sm disabled:opacity-50">上一页</button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1 rounded border border-border text-sm disabled:opacity-50">下一页</button>
        </div>
      )}
    </div>
  );
}
