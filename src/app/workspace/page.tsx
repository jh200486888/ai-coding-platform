'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Code2, Trash2, MessageSquare, FileText, Home, Clock, Edit3 } from 'lucide-react';
import type { Project } from '@/types';

export default function WorkspacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectTech, setNewProjectTech] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const response = await fetch('/api/projects');
    if (response.ok) {
      const data = await response.json();
      setProjects(data);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName, description: newProjectDesc, techStack: newProjectTech }),
    });
    if (response.ok) {
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectTech('');
      setShowNewProject(false);
      fetchProjects();
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？所有文件和数据将被清除。')) return;
    const response = await fetch('/api/projects?id=' + id, { method: 'DELETE' });
    if (response.ok) fetchProjects();
  };

  const startEdit = (p: Project) => {
    setEditingProject(p);
    setEditName(p.name);
    setEditDesc(p.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editName.trim()) return;
    const response = await fetch('/api/workspace/projects/' + editingProject.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    if (response.ok) {
      setEditingProject(null);
      fetchProjects();
    }
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return d.toLocaleDateString('zh-CN');
  };

  const parseTechStack = (techStack: string | undefined): string[] => {
    if (!techStack || techStack === '[]') return [];
    try {
      const parsed = JSON.parse(techStack);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If it's a plain string, split by comma
      return techStack.split(',').map(s => s.trim()).filter(Boolean);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-3 py-2.5 md:px-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
              <Code2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-sm md:text-base font-semibold truncate">编程工作区</h1>
          </Link>
        </div>
        <nav className="flex items-center gap-1 md:gap-2">
          <Link href="/" className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors">
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">首页</span>
          </Link>
        </nav>
      </header>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">我的项目</h2>
            <p className="text-sm text-muted-foreground mt-1">共 {projects.length} 个项目</p>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>

        {/* 新建项目对话框 */}
        {showNewProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-4 border border-border">
              <h2 className="text-lg font-semibold">新建项目</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">项目名称 *</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateProject(); }}
                    placeholder="输入项目名称"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">项目描述</label>
                  <textarea
                    value={newProjectDesc}
                    onChange={e => setNewProjectDesc(e.target.value)}
                    placeholder="简要描述这个项目做什么"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm min-h-[60px] resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">技术栈</label>
                  <input
                    type="text"
                    value={newProjectTech}
                    onChange={e => setNewProjectTech(e.target.value)}
                    placeholder="如：React, Node.js, PostgreSQL（逗号分隔）"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowNewProject(false); setNewProjectName(''); setNewProjectDesc(''); setNewProjectTech(''); }}
                  className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑项目对话框 */}
        {editingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-4 border border-border">
              <h2 className="text-lg font-semibold">编辑项目</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">项目名称</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">项目描述</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm min-h-[60px] resize-none"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors">取消</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">保存</button>
              </div>
            </div>
          </div>
        )}

        {/* 项目列表 */}
        {projects.length === 0 ? (
          <div className="text-center py-16">
            <Code2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-medium mb-2">暂无项目</h2>
            <p className="text-muted-foreground mb-6">创建一个新项目开始你的 AI 编程之旅</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              新建项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const techs = parseTechStack((project as any).tech_stack);
              return (
              <div key={project.id} className="group relative bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <Link href={`/workspace/${project.id}`} className="block">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Code2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                  </div>
                  {techs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {techs.map((t, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {(project as any)._count?.files || 0} 个文件
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {(project as any)._count?.conversations || 0} 条对话
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </Link>
                {/* 操作按钮 */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => { e.preventDefault(); startEdit(project); }}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                    title="编辑项目"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); handleDeleteProject(project.id); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                    title="删除项目"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
