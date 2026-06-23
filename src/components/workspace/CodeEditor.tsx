'use client';

import { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { php } from '@codemirror/lang-php';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { oneDark } from '@codemirror/theme-one-dark';
import type { WorkspaceFile } from '@/types';
import type { Extension } from '@codemirror/state';

interface CodeEditorProps {
  file: WorkspaceFile | null;
  onChange?: (content: string) => void;
}

function getLanguageExtension(filename: string): Extension {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ typescript: ext === 'ts' || ext === 'tsx', jsx: ext === 'jsx' || ext === 'tsx' });
    case 'py':
      return python();
    case 'html':
    case 'htm':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    case 'sql':
      return sql();
    case 'php':
      return php();
    case 'java':
      return java();
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return cpp();
    case 'rs':
      return rust();
    default:
      return [];
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

  const handleChange = (value: string) => {
    setContent(value);
    onChange?.(value);
  };

  const extensions = useMemo(() => {
    if (!file) return [];
    return [getLanguageExtension(file.name)];
  }, [file]);

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
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={content}
          height="100%"
          theme={isDark ? oneDark : 'light'}
          extensions={extensions}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          style={{
            fontSize: '14px',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}
