'use client';

import { useState } from 'react';
import { LoaderCircle, CircleCheck, CircleX, ChevronDown, ChevronRight, Wrench, Users } from 'lucide-react';

const toolNameMap: Record<string, string> = {
  createFile: '创建文件',
  editFile: '修改文件',
  deleteFile: '删除文件',
  readFile: '读取文件',
  runCommand: '执行命令',
  deploy: '部署项目',
  searchWeb: '联网搜索',
  saveMemory: '保存记忆',
  delegate_task: '委派子智能体',
  ssh_execute: '执行SSH命令',
  ssh_read_file: '读取服务器文件',
  ssh_write_file: '写入服务器文件',
  build_project: '构建项目',
  deploy_service: '部署服务',
  health_check: '健康检查',
  git_commit: 'Git提交',
  get_available_skills: '获取技能列表',
  use_skill: '使用技能',
  read_skill_file: '读取技能文件',
  web_scrape: '网页抓取',
  web_search: '联网搜索',
  diagnose_error: '错误诊断',
};

interface ToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
  isSubAgent?: boolean;
  subAgentOutput?: string;
}

export function ToolCallDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const running = toolCalls.filter(tc => tc.status === 'running');
  const done = toolCalls.filter(tc => tc.status === 'done');
  const errors = toolCalls.filter(tc => tc.status === 'error');
  const completed = done.length + errors.length;

  // 还有运行中的 -> 显示实时进度
  if (running.length > 0) {
    const subAgentRunning = running.filter(tc => tc.isSubAgent);
    const normalRunning = running.filter(tc => !tc.isSubAgent);
    
    return (
      <div className="space-y-1">
        {normalRunning.length > 0 && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 cursor-pointer select-none"
            onClick={() => setExpanded(!expanded)}
          >
            <LoaderCircle className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="font-medium">正在运行 {normalRunning.length} 个操作...</span>
            <span className="text-muted-foreground ml-auto flex items-center gap-1">
              {completed > 0 && <span>已完成 {completed} 个</span>}
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          </div>
        )}
        {subAgentRunning.map(tc => (
          <div
            key={tc.callId}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 select-none"
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium truncate">
              {tc.subAgentOutput 
                ? tc.subAgentOutput.replace(/\[子智能体[^\]]*\]\s*/, '').slice(0, 60) || '子智能体执行中...' 
                : '子智能体执行中...'}
            </span>
            <LoaderCircle className="w-3 h-3 animate-spin ml-auto shrink-0" />
          </div>
        ))}
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
            <div key={tc.callId} className="flex items-start gap-2 px-2 py-1.5 rounded-md text-xs">
              {tc.status === 'done' ? <CircleCheck className="w-3 h-3 text-green-500 shrink-0 mt-0.5" /> 
               : tc.status === 'error' ? <CircleX className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
               : <LoaderCircle className="w-3 h-3 text-blue-400 animate-spin shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <span className={"font-medium " + (tc.status === 'error' ? "text-red-400" : "text-foreground")}>
                  {tc.isSubAgent && <Users className="w-3 h-3 inline mr-1" />}
                  {toolNameMap[tc.toolName] || tc.toolName}
                </span>
                {tc.summary && <span className="text-muted-foreground ml-1 truncate">— {tc.summary}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
