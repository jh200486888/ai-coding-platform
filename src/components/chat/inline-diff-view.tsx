'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, FileEdit } from 'lucide-react';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({length: m + 1}, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldLines[i-1] === newLines[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  let i = m, j = n;
  const ops: Array<{type: 'added'|'removed'|'unchanged', oldIdx?: number, newIdx?: number}> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) {
      ops.unshift({type: 'unchanged', oldIdx: i-1, newIdx: j-1}); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({type: 'added', newIdx: j-1}); j--;
    } else {
      ops.unshift({type: 'removed', oldIdx: i-1}); i--;
    }
  }

  let oldNum = 0, newNum = 0;
  for (const op of ops) {
    if (op.type === 'unchanged') { oldNum++; newNum++; result.push({type:'unchanged', content: oldLines[op.oldIdx!], oldLineNum: oldNum, newLineNum: newNum}); }
    else if (op.type === 'removed') { oldNum++; result.push({type:'removed', content: oldLines[op.oldIdx!], oldLineNum: oldNum}); }
    else { newNum++; result.push({type:'added', content: newLines[op.newIdx!], newLineNum: newNum}); }
  }
  return result;
}

interface InlineDiffViewProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  isNew?: boolean;
}

export function InlineDiffView({ filePath, oldContent, newContent, isNew }: InlineDiffViewProps) {
  const [expanded, setExpanded] = useState(false);
  const safeOld = oldContent || '';
  const safeNew = newContent || '';
  const diff = isNew || !safeOld ? safeNew.split('\n').map((line, i) => ({ type: 'added' as const, content: line, newLineNum: i + 1 })) : computeDiff(safeOld, safeNew);
  const added = diff.filter(d => d.type === 'added').length;
  const removed = diff.filter(d => d.type === 'removed').length;

  // Collapse unchanged regions (show first/last 3 lines of unchanged blocks > 8 lines)
  const collapsed: Array<DiffLine | {type: 'ellipsis'; hidden: number}> = [];
  let unchangedRun: DiffLine[] = [];
  for (const line of diff) {
    if (line.type === 'unchanged') { unchangedRun.push(line); }
    else {
      if (unchangedRun.length > 8) {
        collapsed.push(...unchangedRun.slice(0, 3));
        collapsed.push({type: 'ellipsis', hidden: unchangedRun.length - 6});
        collapsed.push(...unchangedRun.slice(-3));
      } else { collapsed.push(...unchangedRun); }
      unchangedRun = [];
      collapsed.push(line);
    }
  }
  if (unchangedRun.length > 8) {
    collapsed.push(...unchangedRun.slice(0, 3));
    collapsed.push({type: 'ellipsis', hidden: unchangedRun.length - 6});
    collapsed.push(...unchangedRun.slice(-3));
  } else { collapsed.push(...unchangedRun); }

  return (
    <div className="my-2 rounded-lg border border-border overflow-hidden bg-[#f6f8fa] dark:bg-[#0d1117]">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-[#e8ecf0] dark:bg-[#161b22] border-b border-[#30363d] cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8b949e]" />}
        <FileEdit className="w-3.5 h-3.5 text-[#8b949e]" />
        <span className="text-xs font-mono text-[#24292f] dark:text-[#c9d1d9] flex-1 truncate">{filePath}</span>
        <span className="text-xs text-green-600 dark:text-green-400">+{added}</span>
        <span className="text-xs text-red-600 dark:text-red-400">-{removed}</span>
      </div>
      {expanded && (
        <div className="overflow-x-auto text-xs font-mono">
          {collapsed.map((line, idx) => {
            if ('hidden' in line && line.type === 'ellipsis') {
              return (
                <div key={idx} className="flex items-center justify-center py-1 bg-[#f0f3f6] dark:bg-[#161b22] text-[#8b949e] border-y border-[#30363d]/50">
                  <span className="text-[10px]">... {line.hidden} unchanged lines</span>
                </div>
              );
            }
            const dl = line as DiffLine;
            const bgClass = dl.type === 'added' ? 'bg-[#ccffd8] dark:bg-[#1a3a2a]' : dl.type === 'removed' ? 'bg-[#ffd7d5] dark:bg-[#3d1a1a]' : '';
            const prefix = dl.type === 'added' ? '+' : dl.type === 'removed' ? '-' : ' ';
            const textColor = dl.type === 'added' ? 'text-[#116329] dark:text-[#7ee787]' : dl.type === 'removed' ? 'text-[#82071e] dark:text-[#ffa198]' : 'text-[#24292f] dark:text-[#c9d1d9]';
            return (
              <div key={idx} className={`flex ${bgClass}`}>
                <span className="w-8 shrink-0 text-right pr-2 text-[#484f58] select-none border-r border-[#30363d]/30">{dl.oldLineNum || ''}</span>
                <span className="w-8 shrink-0 text-right pr-2 text-[#484f58] select-none border-r border-[#30363d]/30">{dl.newLineNum || ''}</span>
                <span className={`pl-1 select-none ${textColor}`}>{prefix}</span>
                <span className={`pl-2 whitespace-pre ${textColor}`}>{dl.content}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
