'use client';

import { useState } from 'react';
import { LoaderCircle, CircleCheck, CircleX, ChevronDown, ChevronRight, Wrench } from 'lucide-react';

const toolNameMap: Record<string, string> = {
  createFile: '创建文件',
  editFile: '修改文件',
  deleteFile: '删除文件',
  readFile: '读取文件',
  runCommand: '执行命令',
  deploy: '部署项目',
  searchWeb: '联网搜索',
  saveMemory: '保存记忆',
};

interface ToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
}

export function ToolCallDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const running = toolCalls.filter(tc => tc.status === 'running');
  const done = toolCalls.filter(tc => tc.status === 'done');
  const errors = toolCalls.filter(tc => tc.status === 'error');
  const completed = done.length + errors.length;

  // 还有运行中的 -> 紧凑提示
  if (running.length > 0) {
    return (
      <div
        className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <LoaderCircle className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span className="font-medium">正在运行 {running.length} 个操作...</span>
        <span className="text-muted-foreground ml-auto flex items-center gap-1">
          {completed > 0 && <span>已完成 {completed} 个</span>}
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </div>
    );
  }

  // 全部完成 -> 折叠状态，点开看详情
  return (
    <div
      className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-pointer select-none hover:bg-muted transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <Wrench className="w-3 h-3 shrink-0" />
      <span className="font-medium">
        已完成 {completed} 个操作
        {done.length > 0 && <span className="text-green-600 dark:text-green-400 ml-1">({done.length}个成功</span>}
        {errors.length > 0 && <span className="text-red-500 ml-0.5">, {errors.length}个失败)</span>}
        {errors.length === 0 && <span className="text-green-600 dark:text-green-400">, 全部成功)</span>}
      </span>
      {expanded ? <ChevronDown className="w-3 h-3 ml-auto shrink-0" /> : <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
      {expanded && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-popover border border-border rounded-lg shadow-lg p-2 space-y-1">
          {toolCalls.map(tc => (
            <div key={tc.callId} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs">
              {tc.status === 'done' ? <CircleCheck className="w-3 h-3 text-green-500 shrink-0" /> : <CircleX className="w-3 h-3 text-red-500 shrink-0" />}
              <span className="font-medium text-foreground">{toolNameMap[tc.toolName] || tc.toolName}</span>
              {tc.summary && <span className="text-muted-foreground truncate">— {tc.summary}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
