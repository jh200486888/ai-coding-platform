'use client';

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { WorkspaceFile } from '@/types';

interface CodeEditorProps {
  file: WorkspaceFile | null;
  onChange?: (content: string) => void;
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'php':
      return 'php';
    case 'java':
      return 'java';
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'rs':
      return 'rust';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'xml':
      return 'xml';
    default:
      return 'plaintext';
  }
}

export function CodeEditor({ file, onChange }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [isDark, setIsDark] = useState(true);

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
          onClick={() => setIsDark(!isDark)}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          {isDark ? '浅色' : '深色'}
        </button>
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={getLanguage(file.name)}
          value={content}
          theme={isDark ? 'vs-dark' : 'vs'}
          onChange={handleChange}
          options={{
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
          }}
        />
      </div>
    </div>
  );
}
