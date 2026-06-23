'use client';

import { Folder, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Folder className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">{project.name}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-popover border border-border rounded-md shadow-lg z-10">
              <button
                onClick={() => {
                  onDelete(project.id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 w-full"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          )}
        </div>
      </div>
      {project.description && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {project.description}
        </p>
      )}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span>{project.files?.length || 0} 个文件</span>
        <span>{project.messages?.length || 0} 条消息</span>
      </div>
    </div>
  );
}
