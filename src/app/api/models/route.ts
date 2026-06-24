import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/models - 获取所有模型配置
export async function GET() {
  try {
    const models = await prisma.modelConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(models);
  } catch (error) {
    console.error('[Models] Failed to fetch models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

// POST /api/models - 创建新的模型配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, name, provider, isActive, sortOrder } = body;

    if (!modelId || !name || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 检查是否已存在
    const existing = await prisma.modelConfig.findFirst({
      where: { modelId },
    });

    if (existing) {
      // 更新已有模型
      const updated = await prisma.modelConfig.update({
        where: { id: existing.id },
        data: {
          name,
          provider,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
      return NextResponse.json(updated);
    }

    const newModel = await prisma.modelConfig.create({
      data: {
        modelId,
        name,
        provider,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json(newModel);
  } catch (error) {
    console.error('[Models] Failed to create model:', error);
    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    );
  }
}

// DELETE /api/models - 删除模型配置
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing model ID' },
        { status: 400 }
      );
    }

    await prisma.modelConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Models] Failed to delete model:', error);
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
