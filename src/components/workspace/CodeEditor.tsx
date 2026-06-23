'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { WorkspaceFile } from '@/types';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
  file: WorkspaceFile | null;
  onChange?: (content: string) => void;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    java: 'java',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
  };
  return languageMap[ext || ''] || 'plaintext';
}

export function CodeEditor({ file, onChange }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
    } else {
      setContent('');
    }
  }, [file]);

  const handleChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    onChange?.(newContent);
  };

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📝</div>
          <p>选择一个文件开始编辑</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 文件标签 */}
      <div className="h-10 bg-card border-b border-border flex items-center px-4">
        <span className="text-sm font-medium">{file.name}</span>
        <button
          onClick={() => setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark')}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          {theme === 'vs-dark' ? '浅色' : '深色'}
        </button>
      </div>

      {/* 编辑器 */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={getLanguageFromFilename(file.name)}
          value={content}
          onChange={handleChange}
          theme={theme}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
