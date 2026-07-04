'use client';

import { useState, useEffect, useRef } from 'react';
import { LoaderCircle, CircleCheck, CircleX, ChevronDown, ChevronRight, Wrench, Users, Terminal, FileEdit, Search, Globe, Box, Files } from 'lucide-react';
import { InlineDiffView } from './inline-diff-view';

const toolNameMap: Record<string, string> = {
  createFile: '创建文件', editFile: '修改文件', deleteFile: '删除文件',
  readFile: '读取文件', runCommand: '执行命令', deploy: '部署项目',
  searchWeb: '联网搜索', saveMemory: '保存记忆',
  delegate_task: '委派子智能体', ssh_execute: '执行命令',
  ssh_read_file: '读取服务器文件', ssh_write_file: '写入服务器文件',
  build_project: '构建项目', deploy_service: '部署服务',
  health_check: '健康检查', git_commit: 'Git提交',
  get_available_skills: '获取技能列表', use_skill: '使用技能',
  read_skill_file: '读取技能文件', web_scrape: '网页抓取',
  web_search: '联网搜索', preview_html: '页面预览',
  diagnose_error: '错误诊断', smart_search: '智能搜索',
  read_url: '读取网页', analyze_image: '图片分析',
  execute_code: '执行代码', browser_navigate: '浏览器导航',
  browser_click: '浏览器点击', browser_screenshot: '浏览器截图',
  plan_and_execute: '规划并执行', aggregate_results: '汇总结果',
  db_query: '数据库查询', db_list_tables: '列出数据表',
};

// Tool category icons
const toolIconMap: Record<string, any> = {
  ssh_execute: Terminal,
  ssh_write_file: FileEdit,
  ssh_read_file: Terminal,
  build_project: Box,
  deploy_service: Box,
  searchWeb: Search,
  smart_search: Search,
  web_search: Globe,
  web_scrape: Globe,
  read_url: Globe,
  browser_navigate: Globe,
  browser_click: Globe,
  browser_screenshot: Globe,
};

// File-modifying tool names
const FILE_CHANGE_TOOLS = ['ssh_write_file', 'createFile', 'editFile'];

function getToolIcon(toolName: string) {
  return toolIconMap[toolName] || Wrench;
}

function getToolSummary(toolName: string, args?: Record<string, unknown>): string {
  if (!args) return '';
  if (toolName === 'ssh_execute') {
    const cmd = String(args?.command || '').trim();
    return cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd;
  }
  if (toolName === 'ssh_write_file' || toolName === 'createFile' || toolName === 'editFile') {
    const path = String(args.path || '').trim();
    return path ? path.split('/').pop() || path : '';
  }
  if (toolName === 'searchWeb' || toolName === 'web_search' || toolName === 'smart_search') {
    return String(args.query || args.question || '').slice(0, 50);
  }
  if (toolName === 'read_url' || toolName === 'web_scrape') {
    return String(args.url || '').slice(0, 50);
  }
  if (toolName === 'db_query') {
    return String(args.sql || '').slice(0, 60);
  }
  return '';
}

interface ToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
  isSubAgent?: boolean;
  subAgentOutput?: string;
  oldContent?: string;
  newContent?: string;
}

// FileChangeSummary: shows when 2+ file modification tool calls exist
function FileChangeSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const fileChanges = toolCalls.filter(tc =>
    FILE_CHANGE_TOOLS.includes(tc.toolName) &&
    (tc.status === 'done') &&
    (tc.oldContent !== undefined || tc.newContent !== undefined)
  );

  if (!fileChanges || fileChanges.length < 2) return null;

  let totalAdded = 0;
  let totalRemoved = 0;
  for (const tc of fileChanges) {
    const oldText = tc.oldContent || '';
    const newText = tc.newContent || String(tc.args?.content || '');
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    // Quick estimate for summary
    totalAdded += Math.max(0, newLines.length - oldLines.length);
    totalRemoved += Math.max(0, oldLines.length - newLines.length);
  }

  return (
    <div className="my-2 rounded-lg border border-border overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/80 cursor-pointer select-none hover:bg-muted transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Files className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium flex-1">{fileChanges.length} 个文件已修改</span>
        {totalAdded > 0 && <span className="text-xs text-green-600 dark:text-green-400">+{totalAdded}</span>}
        {totalRemoved > 0 && <span className="text-xs text-red-600 dark:text-red-400">-{totalRemoved}</span>}
      </div>
      {expanded && (
        <div className="p-2 space-y-1 bg-muted/30">
          {fileChanges.map(tc => {
            const path = String(tc.args?.path || tc.args?.filePath || '');
            const oldContent = tc.oldContent || '';
            const newContent = tc.newContent || String(tc.args?.content || '');
            const isNew = !tc.oldContent || tc.oldContent.trim().length === 0;
            return (
              <InlineDiffView
                key={tc.callId}
                filePath={path}
                oldContent={oldContent}
                newContent={newContent}
                isNew={isNew}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ToolCallDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);

  const running = (toolCalls || []).filter(tc => tc.status === 'running');
  const done = (toolCalls || []).filter(tc => tc.status === 'done');
  const errors = (toolCalls || []).filter(tc => tc.status === 'error');
  const completed = done.length + errors.length;

  // Timer for running state
  useEffect(() => {
    if (running.length > 0) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running.length]);

  // Running state
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
            <span className="font-medium">
              正在运行 {normalRunning.length} 个操作
              {completed > 0 && <span className="ml-1 text-blue-500">(+{completed} 已完成)</span>}
            </span>
            <span className="text-muted-foreground ml-auto flex items-center gap-1.5">
              {elapsed > 0 && <span className="tabular-nums">{elapsed}s</span>}
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          </div>
        )}

        {/* Show individual running tools when expanded */}
        {expanded && normalRunning.map(tc => {
          const Icon = getToolIcon(tc.toolName);
          const summary = getToolSummary(tc.toolName, tc.args);
          return (
            <div key={tc.callId} className="flex items-center gap-2 text-xs px-3 py-1.5 ml-4 rounded-md border bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50">
              <Icon className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="font-medium">{toolNameMap[tc.toolName] || tc.toolName}</span>
              {summary && <span className="text-muted-foreground truncate ml-1">-- {summary}</span>}
              <LoaderCircle className="w-3 h-3 animate-spin ml-auto shrink-0 text-blue-400" />
            </div>
          );
        })}

        {/* Completed tools when expanded */}
        {expanded && (done.length > 0 || errors.length > 0) && (
          <div className="ml-4 space-y-0.5">
            {[...done, ...errors].map(tc => {
              const Icon = getToolIcon(tc.toolName);
              return (
                <div key={tc.callId} className="flex items-center gap-2 text-xs px-3 py-1 rounded-md">
                  {tc.status === 'done'
                    ? <CircleCheck className="w-3 h-3 text-green-500 shrink-0" />
                    : <CircleX className="w-3 h-3 text-red-500 shrink-0" />}
                  <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-medium">{toolNameMap[tc.toolName] || tc.toolName}</span>
                  {tc.summary && <span className="text-muted-foreground ml-1 truncate">-- {tc.summary}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-agent cards */}
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

  // All completed
  return (
    <div className="space-y-1">
      {/* File change summary (when 2+ file changes) */}
      <FileChangeSummary toolCalls={toolCalls} />

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
      </div>

      {expanded && (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-2 space-y-1">
          {toolCalls.map(tc => {
            const Icon = getToolIcon(tc.toolName);
            const summary = tc.summary || getToolSummary(tc.toolName, tc.args);
            const isFileTool = FILE_CHANGE_TOOLS.includes(tc.toolName) && tc.status === 'done';
            const hasDiff = isFileTool && (tc.oldContent !== undefined || tc.newContent !== undefined);
            const filePath = String(tc.args?.path || tc.args?.filePath || '');
            const newContent = tc.newContent || String(tc.args?.content || '');
            const oldContent = tc.oldContent || '';
            const isNewFile = !tc.oldContent || tc.oldContent.trim().length === 0;

            return (
              <div key={tc.callId} className="space-y-1">
                <div className="flex items-start gap-2 px-2 py-1.5 rounded-md text-xs">
                  {tc.status === 'done' ? <CircleCheck className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                   : tc.status === 'error' ? <CircleX className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                   : <LoaderCircle className="w-3 h-3 text-blue-400 animate-spin shrink-0 mt-0.5" />}
                  <Icon className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className={"font-medium " + (tc.status === 'error' ? "text-red-400" : "text-foreground")}>
                      {tc.isSubAgent && <Users className="w-3 h-3 inline mr-1" />}
                      {toolNameMap[tc.toolName] || tc.toolName}
                    </span>
                    {summary && <span className="text-muted-foreground ml-1 truncate block">-- {summary}</span>}
                  </div>
                </div>

                {/* Inline diff for file-modifying tools */}
                {hasDiff && filePath && (
                  <div className="ml-6">
                    <InlineDiffView
                      filePath={filePath}
                      oldContent={oldContent}
                      newContent={newContent}
                      isNew={isNewFile}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
