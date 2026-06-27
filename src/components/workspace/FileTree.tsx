'use client';

import { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { WorkspaceFile } from '@/types';

interface FileTreeProps {
  files: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileCreate: (name: string, type: 'file' | 'folder', parentId?: string) => void;
  onFileDelete: (fileId: string) => void;
}

interface TreeNodeProps {
  file: WorkspaceFile;
  children: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  onSelect: (file: WorkspaceFile) => void;
  onDelete: (fileId: string) => void;
  level: number;
}

function TreeNode({ file, children, activeFile, onSelect, onDelete, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isFolder = file.type === 'folder';
  const isActive = activeFile?.id === file.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent rounded overflow-hidden ${
          isActive ? 'bg-accent' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={() => {
          if (isFolder) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(file);
          }
        }}
      >
        {isFolder && (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Folder className="w-4 h-4 text-blue-500" />
          </>
        )}
        {!isFolder && (
          <>
            <span className="w-4" />
            <File className="w-4 h-4 text-muted-foreground" />
          </>
        )}
        <span className="text-sm flex-1 truncate min-w-0">{file.name}</span>
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete(file.id);
          }}
          className="opacity-0 group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {isFolder && isExpanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNode
              key={child.id}
              file={child}
              children={[]}
              activeFile={activeFile}
              onSelect={onSelect}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, activeFile, onFileSelect, onFileCreate, onFileDelete }: FileTreeProps) {
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');

  // 构建树结构
  const rootFiles = files.filter(f => !f.parentId);
  const getChildren = (parentId: string) => files.filter(f => f.parentId === parentId);

  const handleCreate = () => {
    if (newFileName.trim()) {
      onFileCreate(newFileName.trim(), newFileType);
      setNewFileName('');
      setShowNewFileInput(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* 标题栏 */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-border">
        <span className="text-sm font-medium">文件</span>
        <button
          onClick={() => setShowNewFileInput(!showNewFileInput)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 新建文件输入 */}
      {showNewFileInput && (
        <div className="p-2 border-b border-border">
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setNewFileType('file')}
              className={`text-xs px-2 py-1 rounded ${
                newFileType === 'file' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              文件
            </button>
            <button
              onClick={() => setNewFileType('folder')}
              className={`text-xs px-2 py-1 rounded ${
                newFileType === 'folder' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              文件夹
            </button>
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              placeholder="名称"
              className="flex-1 text-xs bg-background border border-border rounded px-2 py-1"
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowNewFileInput(false);
              }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded"
            >
              创建
            </button>
          </div>
        </div>
      )}

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto py-2">
        {rootFiles.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            暂无文件
          </div>
        ) : (
          rootFiles.map(file => (
            <TreeNode
              key={file.id}
              file={file}
              children={getChildren(file.id)}
              activeFile={activeFile}
              onSelect={onFileSelect}
              onDelete={onFileDelete}
              level={0}
            />
          ))
        )}
      </div>
    </div>
  );
}
