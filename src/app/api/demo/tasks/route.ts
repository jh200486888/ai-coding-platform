// ============================================
// 🚀 Next.js 16 API Route 演示 - 任务CRUD
// ============================================
// 演示: RESTful API、内存数据管理、请求验证

import { NextRequest, NextResponse } from 'next/server';

// 任务类型定义
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

// 内存数据存储（生产环境应使用数据库）
let tasks: Task[] = [
  {
    id: '1',
    title: '调研Next.js 16新特性',
    description: '深入了解React Server Components、Server Actions等核心特性',
    status: 'done',
    priority: 'high',
    createdAt: '2025-12-01T08:00:00Z',
    updatedAt: '2025-12-03T10:30:00Z',
  },
  {
    id: '2',
    title: '搭建项目基础架构',
    description: '配置TypeScript、ESLint、Tailwind CSS等开发工具链',
    status: 'in_progress',
    priority: 'high',
    createdAt: '2025-12-02T09:00:00Z',
    updatedAt: '2025-12-04T14:00:00Z',
  },
  {
    id: '3',
    title: '实现用户认证模块',
    description: '集成NextAuth.js，实现登录/注册/权限管理',
    status: 'todo',
    priority: 'medium',
    createdAt: '2025-12-03T10:00:00Z',
    updatedAt: '2025-12-03T10:00:00Z',
  },
  {
    id: '4',
    title: '编写单元测试',
    description: '使用Vitest为核心功能编写测试用例，保证代码质量',
    status: 'todo',
    priority: 'low',
    createdAt: '2025-12-04T11:00:00Z',
    updatedAt: '2025-12-04T11:00:00Z',
  },
  {
    id: '5',
    title: '部署到生产环境',
    description: '配置CI/CD流水线，自动化构建和部署流程',
    status: 'todo',
    priority: 'medium',
    createdAt: '2025-12-05T12:00:00Z',
    updatedAt: '2025-12-05T12:00:00Z',
  },
];

// GET /api/demo/tasks - 获取任务列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');

  let filtered = [...tasks];

  if (status) {
    filtered = filtered.filter((t) => t.status === status);
  }
  if (priority) {
    filtered = filtered.filter((t) => t.priority === priority);
  }

  // 按创建时间倒序
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    success: true,
    data: filtered,
    total: filtered.length,
    timestamp: new Date().toISOString(),
  });
}

// POST /api/demo/tasks - 创建新任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, priority } = body;

    // 数据验证
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: '标题至少需要2个字符' },
        { status: 400 }
      );
    }

    const validPriorities = ['low', 'medium', 'high'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

    const newTask: Task = {
      id: String(Date.now()),
      title: title.trim(),
      description: description?.trim() || '',
      status: 'todo',
      priority: taskPriority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.unshift(newTask);

    return NextResponse.json(
      { success: true, data: newTask, message: '任务创建成功' },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '请求数据格式错误' },
      { status: 400 }
    );
  }
}
