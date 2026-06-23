import { NextRequest, NextResponse } from 'next/server';

// POST /api/workspace/upload - 上传附件
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 检查文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // 检查文件类型
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'text/markdown',
      'text/javascript', 'application/typescript',
      'text/html', 'text/css', 'application/json',
      'text/x-python',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(js|ts|jsx|tsx|py|html|css|json|md|txt)$/)) {
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Content = buffer.toString('base64');

    // 根据文件类型决定处理方式
    let content = '';
    let type = 'text';

    if (file.type.startsWith('image/')) {
      // 图片文件：转为 base64 data URL
      content = `data:${file.type};base64,${base64Content}`;
      type = 'image';
    } else if (file.type === 'application/pdf') {
      // PDF 文件：保存为 base64（实际应用中可能需要解析）
      content = `data:application/pdf;base64,${base64Content}`;
      type = 'document';
    } else {
      // 文本文件：直接读取内容
      content = buffer.toString('utf-8');
      type = 'text';
    }

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        content,
        dataType: type,
      },
    });
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
