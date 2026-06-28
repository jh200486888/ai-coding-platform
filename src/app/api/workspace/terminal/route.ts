import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentUser } from '@/lib/auth';

const execAsync = promisify(exec);

// POST /api/workspace/terminal - 执行终端命令
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(); if (!user) { return NextResponse.json({ error: "请先登录" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { command, cwd } = body;

    if (!command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      );
    }

    // 安全检查：禁止危险命令
    const dangerousCommands = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', ':(){:|:&};:'];
    if (dangerousCommands.some(dc => command.includes(dc))) {
      return NextResponse.json(
        { error: 'Dangerous command not allowed' },
        { status: 403 }
      );
    }

    // 执行命令
    const options: { cwd?: string; timeout: number; maxBuffer: number } = {
      timeout: 30000, // 30 秒超时
      maxBuffer: 1024 * 1024, // 1MB 输出限制
    };

    if (cwd) {
      options.cwd = cwd;
    }

    const { stdout, stderr } = await execAsync(command, options);

    return NextResponse.json({
      success: true,
      output: stdout || stderr || 'Command executed successfully',
      exitCode: stderr ? 1 : 0,
    });
  } catch (error) {
    console.error('Terminal command error:', error);
    
    // 如果是执行错误，返回错误信息
    if (error instanceof Error) {
      return NextResponse.json({
        success: false,
        output: error.message,
        exitCode: 1,
      });
    }

    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
