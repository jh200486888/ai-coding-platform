'use client';

import { useState, useCallback } from 'react';
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileCode, 
  FileJson, 
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string | null;
  parentId: string | null;
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  selectedFileId: string | null;
  onFileSelect: (file: FileNode) => void;
  onFileCreate: (parentId: string | null, type: 'file' | 'folder', name: string) => void;
  onFileDelete: (fileId: string) => void;
  onFileRename: (fileId: string, newName: string) => void;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <FileCode className="w-4 h-4 text-yellow-500" />;
    case 'json':
      return <FileJson className="w-4 h-4 text-green-500" />;
    case 'md':
    case 'txt':
      return <FileText className="w-4 h-4 text-blue-400" />;
    case 'html':
    case 'css':
    case 'scss':
      return <FileCode className="w-4 h-4 text-orange-500" />;
    case 'py':
      return <FileCode className="w-4 h-4 text-blue-500" />;
    default:
      return <File className="w-4 h-4 text-gray-400" />;
  }
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  selectedFileId: string | null;
  expandedFolders: Set<string>;
  onToggle: (nodeId: string) => void;
  onFileSelect: (file: FileNode) => void;
  onFileCreate: (parentId: string | null, type: 'file' | 'folder', name: string) => void;
  onFileDelete: (fileId: string) => void;
  onFileRename: (fileId: string, newName: string) => void;
}

function TreeNode({
  node,
  level,
  selectedFileId,
  expandedFolders,
  onToggle,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
}: TreeNodeProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [showNewInput, setShowNewInput] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFileId === node.id;
  const isFolder = node.type === 'folder';

  const handleRename = () => {
    if (newName && newName !== node.name) {
      onFileRename(node.id, newName);
    }
    setIsRenaming(false);
  };

  const handleCreate = (type: 'file' | 'folder') => {
    if (newItemName) {
      onFileCreate(node.id, type, newItemName);
      setNewItemName('');
      setShowNewInput(null);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-700/50 rounded group',
          isSelected && 'bg-primary/20 text-primary'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.id);
          } else {
            onFileSelect(node);
          }
        }}
      >
        {isFolder && (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        )}
        {!isFolder && <span className="w-4 h-4" />}
        
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-blue-400" />
          ) : (
            <Folder className="w-4 h-4 text-blue-400" />
          )
        ) : (
          getFileIcon(node.name)
        )}

        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="flex-1 bg-gray-700 px-1 text-sm rounded"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate">{node.name}</span>
        )}

        <div className="hidden group-hover:flex items-center gap-1">
          {isFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewInput('file');
              }}
              className="p-0.5 hover:bg-gray-600 rounded"
              title="新建文件"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-0.5 hover:bg-gray-600 rounded"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </div>

        {showMenu && (
          <div className="absolute right-2 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
                setShowMenu(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 w-full text-left text-sm"
            >
              <Edit2 className="w-3 h-3" />
              重命名
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileDelete(node.id);
                setShowMenu(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 w-full text-left text-sm text-red-400"
            >
              <Trash2 className="w-3 h-3" />
              删除
            </button>
          </div>
        )}
      </div>

      {showNewInput && (
        <div
          className="flex items-center gap-1 px-2 py-1"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          {showNewInput === 'folder' ? (
            <Folder className="w-4 h-4 text-blue-400" />
          ) : (
            getFileIcon(newItemName || 'file.txt')
          )}
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate(showNewInput);
              if (e.key === 'Escape') setShowNewInput(null);
            }}
            onBlur={() => setShowNewInput(null)}
            placeholder={showNewInput === 'folder' ? '文件夹名称' : '文件名称'}
            className="flex-1 bg-gray-700 px-1 text-sm rounded"
            autoFocus
          />
        </div>
      )}

      {isExpanded && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          selectedFileId={selectedFileId}
          expandedFolders={expandedFolders}
          onToggle={onToggle}
          onFileSelect={onFileSelect}
          onFileCreate={onFileCreate}
          onFileDelete={onFileDelete}
          onFileRename={onFileRename}
        />
      ))}
    </div>
  );
}

export function FileTree({
  files,
  selectedFileId,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showRootNew, setShowRootNew] = useState<'file' | 'folder' | null>(null);
  const [rootNewItemName, setRootNewItemName] = useState('');

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Build tree structure
  const buildTree = (nodes: FileNode[], parentId: string | null = null): FileNode[] => {
    return nodes
      .filter((node) => node.parentId === parentId)
      .map((node) => ({
        ...node,
        children: buildTree(nodes, node.id),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  };

  const tree = buildTree(files);

  const handleRootCreate = (type: 'file' | 'folder') => {
    if (rootNewItemName) {
      onFileCreate(null, type, rootNewItemName);
      setRootNewItemName('');
      setShowRootNew(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">文件</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRootNew('file')}
            className="p-1 hover:bg-gray-700 rounded"
            title="新建文件"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            selectedFileId={selectedFileId}
            expandedFolders={expandedFolders}
            onToggle={handleToggle}
            onFileSelect={onFileSelect}
            onFileCreate={onFileCreate}
            onFileDelete={onFileDelete}
            onFileRename={onFileRename}
          />
        ))}

        {showRootNew && (
          <div className="flex items-center gap-1 px-2 py-1">
            {showRootNew === 'folder' ? (
              <Folder className="w-4 h-4 text-blue-400" />
            ) : (
              getFileIcon(rootNewItemName || 'file.txt')
            )}
            <input
              type="text"
              value={rootNewItemName}
              onChange={(e) => setRootNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRootCreate(showRootNew);
                if (e.key === 'Escape') setShowRootNew(null);
              }}
              onBlur={() => setShowRootNew(null)}
              placeholder={showRootNew === 'folder' ? '文件夹名称' : '文件名称'}
              className="flex-1 bg-gray-700 px-1 text-sm rounded"
              autoFocus
            />
          </div>
        )}

        {tree.length === 0 && !showRootNew && (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">
            暂无文件，点击 + 创建
          </div>
        )}
      </div>
    </div>
  );
}
