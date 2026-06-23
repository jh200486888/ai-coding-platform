'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Code2, Trash2 } from 'lucide-react';
import { ProjectCard } from '@/components/workspace/ProjectCard';
import type { Project } from '@/types';

export default function WorkspacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

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
      body: JSON.stringify({ name: newProjectName }),
    });
    
    if (response.ok) {
      setNewProjectName('');
      setShowNewProject(false);
      fetchProjects();
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return;
    
    const response = await fetch(`/api/projects?id=${id}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      fetchProjects();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">编程工作区</h1>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </button>
      </header>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto p-6">
        {/* 新建项目对话框 */}
        {showNewProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold">新建项目</h2>
              <input
                type="text"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="项目名称"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNewProject(false)}
                  className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 项目列表 */}
        {projects.length === 0 ? (
          <div className="text-center py-16">
            <Code2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-medium mb-2">暂无项目</h2>
            <p className="text-muted-foreground mb-6">
              创建一个新项目开始你的 AI 编程之旅
            </p>
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
            {projects.map(project => (
              <Link key={project.id} href={`/workspace/${project.id}`}>
                <ProjectCard
                  project={project}
                  onDelete={() => handleDeleteProject(project.id)}
                />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
