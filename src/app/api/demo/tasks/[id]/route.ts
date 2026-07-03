// ============================================
// 🚀 Next.js 16 API Route - 单任务CRUD
// ============================================
// 演示: 动态路由参数、错误处理、HTTP方法

import { NextRequest, NextResponse } from 'next/server';

// 任务类型
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

// 复用内存数据（实际项目中应从数据库获取）
// 使用全局变量确保所有路由共享同一份数据
declare global {
  var __demo_tasks: Task[] | undefined;
}

function getTasks(): Task[] {
  if (!global.__demo_tasks) {
    global.__demo_tasks = [
      { id: '1', title: '调研Next.js 16新特性', description: '深入了解React Server Components、Server Actions等核心特性', status: 'done', priority: 'high', createdAt: '2025-12-01T08:00:00Z', updatedAt: '2025-12-03T10:30:00Z' },
      { id: '2', title: '搭建项目基础架构', description: '配置TypeScript、ESLint、Tailwind CSS等开发工具链', status: 'in_progress', priority: 'high', createdAt: '2025-12-02T09:00:00Z', updatedAt: '2025-12-04T14:00:00Z' },
      { id: '3', title: '实现用户认证模块', description: '集成NextAuth.js，实现登录/注册/权限管理', status: 'todo', priority: 'medium', createdAt: '2025-12-03T10:00:00Z', updatedAt: '2025-12-03T10:00:00Z' },
      { id: '4', title: '编写单元测试', description: '使用Vitest为核心功能编写测试用例', status: 'todo', priority: 'low', createdAt: '2025-12-04T11:00:00Z', updatedAt: '2025-12-04T11:00:00Z' },
      { id: '5', title: '部署到生产环境', description: '配置CI/CD流水线，自动化构建和部署流程', status: 'todo', priority: 'medium', createdAt: '2025-12-05T12:00:00Z', updatedAt: '2025-12-05T12:00:00Z' },
    ];
  }
  return global.__demo_tasks;
}

// 获取单个任务
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return NextResponse.json(
      { success: false, error: '任务不存在' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: task });
}

// 更新任务
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = getTasks();
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return NextResponse.json(
      { success: false, error: '任务不存在' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { title, description, status, priority } = body;

    const validStatuses = ['todo', 'in_progress', 'done'];
    const validPriorities = ['low', 'medium', 'high'];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
      return NextResponse.json(
        { success: false, error: '标题至少需要2个字符' },
        { status: 400 }
      );
    }

    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态值' },
        { status: 400 }
      );
    }

    if (priority !== undefined && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { success: false, error: '无效的优先级' },
        { status: 400 }
      );
    }

    const updatedTask: Task = {
      ...tasks[index],
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updatedTask;

    return NextResponse.json({
      success: true,
      data: updatedTask,
      message: '任务更新成功',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '请求数据格式错误' },
      { status: 400 }
    );
  }
}

// 删除任务
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = getTasks();
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return NextResponse.json(
      { success: false, error: '任务不存在' },
      { status: 404 }
    );
  }

  tasks.splice(index, 1);

  return NextResponse.json({
    success: true,
    message: '任务删除成功',
  });
}
