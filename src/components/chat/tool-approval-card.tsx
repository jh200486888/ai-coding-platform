'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldX, ChevronDown, ChevronRight, LoaderCircle, CheckCircle2, XCircle } from 'lucide-react';

/**
 * ToolApprovalCard - AI SDK official tool approval flow
 * 
 * State transitions per AI SDK docs:
 * - approval-requested: user needs to approve/deny (part.approval.id available)
 * - approval-responded: user responded, waiting for server execution
 * - output-available: tool executed successfully
 * - output-denied: user denied the tool execution
 * 
 * Uses addToolApprovalResponse({ id, approved }) from useChat hook.
 * sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses
 * handles auto-submit after approval.
 */

const TOOL_DISPLAY: Record<string, { name: string; risk: 'high' | 'medium' | 'low'; reason: string }> = {
  ssh_execute: { name: '执行SSH命令', risk: 'medium', reason: '将在远程服务器上执行命令' },
  ssh_write_file: { name: '写入服务器文件', risk: 'high', reason: '将修改服务器上的文件（自动备份）' },
  build_project: { name: '构建项目', risk: 'medium', reason: '将执行pnpm build，耗时约1-2分钟' },
  deploy_service: { name: '部署服务', risk: 'high', reason: '将重启PM2服务并部署新版本' },
  health_check: { name: '健康检查', risk: 'low', reason: '只读检查，不影响服务' },
  git_commit: { name: 'Git提交', risk: 'medium', reason: '将提交代码变更' },
  ssh_read_file: { name: '读取服务器文件', risk: 'low', reason: '只读操作，不影响服务器' },
  web_scrape: { name: '网页抓取', risk: 'low', reason: '读取网页内容，不影响服务器' },
  web_search: { name: '联网搜索', risk: 'low', reason: '搜索互联网信息' },
  preview_html: { name: '页面预览', risk: 'low', reason: '在沙盒中预览HTML' },
  diagnose_error: { name: '错误诊断', risk: 'low', reason: '只读诊断，不影响服务' },
};

const RISK_STYLE = {
  high: { bg: 'bg-red-500/5', border: 'border-red-500/30', badge: 'bg-red-500/20 text-red-400', label: '高风险' },
  medium: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-400', label: '中风险' },
  low: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400', label: '低风险' },
};

type ApprovalState = 'approval-requested' | 'approval-responded' | 'output-available' | 'output-denied';

interface ToolApprovalCardProps {
  toolName: string;
  args: Record<string, unknown>;
  state: ApprovalState;
  approvalId?: string;
  isAutomatic?: boolean;
  approved?: boolean;
  reason?: string;
  output?: string;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

export function ToolApprovalCard({
  toolName, args, state, approvalId, isAutomatic, approved, reason, output,
  onApprove, onDeny,
}: ToolApprovalCardProps) {
  const [expanded, setExpanded] = useState(state === 'approval-requested' && !isAutomatic);

  const info = TOOL_DISPLAY[toolName] || { name: toolName, risk: 'low' as const, reason: '需要确认后执行' };
  const style = RISK_STYLE[info.risk];

  // 关键参数提取
  const keyArgs: [string, string][] = [];
  if (toolName === 'ssh_execute' && args.command) {
    keyArgs.push(['命令', String(args.command).slice(0, 300)]);
    if (args.server) keyArgs.push(['服务器', String(args.server)]);
  } else if (toolName === 'ssh_write_file' && args.path) {
    keyArgs.push(['文件路径', String(args.path)]);
    if (args.server) keyArgs.push(['服务器', String(args.server)]);
  } else if (toolName === 'git_commit' && args.message) {
    keyArgs.push(['提交信息', String(args.message)]);
  } else {
    for (const [k, v] of Object.entries(args).slice(0, 4)) {
      keyArgs.push([k, String(v).slice(0, 150)]);
    }
  }

  // State-based rendering
  const renderState = () => {
    switch (state) {
      case 'approval-requested':
        if (isAutomatic) {
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle className="w-3 h-3 animate-spin" />
              自动审批中...
            </div>
          );
        }
        return (
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => approvalId && onDeny?.(approvalId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-colors"
            >
              <ShieldX className="w-3.5 h-3.5" />拒绝
            </button>
            <button
              onClick={() => approvalId && onApprove?.(approvalId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />批准执行
            </button>
          </div>
        );

      case 'approval-responded':
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="w-3 h-3 animate-spin" />
            {approved ? '已批准，执行中...' : '已拒绝'}
            {reason && <span className="ml-1 text-muted-foreground/70">({reason})</span>}
          </div>
        );

      case 'output-available':
        return (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            执行完成
            {output && <span className="text-muted-foreground ml-1 truncate max-w-[300px]">{String(output).slice(0, 80)}</span>}
          </div>
        );

      case 'output-denied':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            已拒绝执行
            {reason && <span className="text-muted-foreground ml-1">({reason})</span>}
          </div>
        );
    }
  };

  return (
    <div className={`my-2 rounded-lg border ${style.border} ${style.bg} overflow-hidden`}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-sm font-medium text-foreground">{info.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
        <span className="text-xs text-muted-foreground">{info.reason}</span>
        <span className="ml-auto">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {(keyArgs?.length || 0) > 0 && (
            <div className="bg-black/20 rounded-md px-3 py-2 space-y-1">
              {keyArgs.map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 min-w-[60px]">{key}:</span>
                  <span className="text-foreground font-mono break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
          {renderState()}
        </div>
      )}
    </div>
  );
}
