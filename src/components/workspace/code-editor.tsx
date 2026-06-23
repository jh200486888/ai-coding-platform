'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Circle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EditorTab {
  id: string;
  name: string;
  path: string;
  content: string;
  isDirty: boolean;
  language: string;
}

interface CodeEditorProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onSave: (tabId: string) => void;
  theme?: 'vs-dark' | 'vs-light';
  diffHighlights?: { path: string; lines: number[] }[];
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return langMap[ext || ''] || 'plaintext';
}

export function CodeEditor({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSave,
  theme = 'vs-dark',
  diffHighlights = [],
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [editorTheme, setEditorTheme] = useState(theme);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Configure keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTab) {
        onSave(activeTab.id);
      }
    });

    // Define custom theme for diff highlights
    monaco.editor.defineTheme('workspace-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f0f14',
        'editor.lineHighlightBackground': '#1a1a24',
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (activeTab) {
        onSave(activeTab.id);
      }
    }
  };

  if (!activeTab) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f0f14] text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">选择一个文件开始编辑</p>
          <p className="text-sm">从左侧文件树中选择文件，或创建新文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0f0f14]" onKeyDown={handleKeyDown}>
      {/* Tab bar */}
      <div className="flex items-center bg-[#1a1a24] border-b border-gray-800 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'flex items-center gap-2 px-4 py-2 border-r border-gray-800 cursor-pointer min-w-0 group',
              tab.id === activeTabId
                ? 'bg-[#0f0f14] text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            )}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.isDirty && (
              <Circle className="w-2 h-2 fill-current text-primary flex-shrink-0" />
            )}
            <span className="truncate text-sm">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-700 rounded flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={activeTab.language}
          value={activeTab.content}
          theme={editorTheme}
          onMount={handleEditorMount}
          onChange={(value) => {
            if (value !== undefined) {
              onContentChange(activeTab.id, value);
            }
          }}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            folding: true,
            foldingStrategy: 'indentation',
            renderLineHighlight: 'all',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            padding: { top: 10 },
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-[#1a1a24] border-t border-gray-800 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>{activeTab.language}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          {activeTab.isDirty && (
            <span className="text-yellow-400">未保存</span>
          )}
          <button
            onClick={() => onSave(activeTab.id)}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded',
              activeTab.isDirty
                ? 'hover:bg-gray-700 text-gray-300'
                : 'text-gray-500 cursor-not-allowed'
            )}
            disabled={!activeTab.isDirty}
          >
            <Save className="w-3 h-3" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
