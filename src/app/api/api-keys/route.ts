import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encodeApiKey } from '@/lib/ai-providers';

// GET /api/api-keys - 获取所有 API Key
export async function GET() {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 隐藏实际的 API Key，只返回前几位
    const safeApiKeys = apiKeys.map((key: { id: string; name: string; provider: string; apiKey: string; createdAt: Date }) => ({
      ...key,
      apiKey: key.apiKey.substring(0, 8) + '...',
    }));

    return NextResponse.json(safeApiKeys);
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/api-keys - 创建新的 API Key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, name, apiKey, baseUrl } = body;

    if (!provider || !name || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 编码 API Key
    const encodedApiKey = encodeApiKey(apiKey);

    const newApiKey = await prisma.apiKey.create({
      data: {
        provider,
        name,
        apiKey: encodedApiKey,
        baseUrl: baseUrl || null,
      },
    });

    return NextResponse.json({
      ...newApiKey,
      apiKey: newApiKey.apiKey.substring(0, 8) + '...',
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/api-keys - 删除 API Key
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing API key ID' },
        { status: 400 }
      );
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}

// PATCH /api/api-keys - 更新 API Key
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, provider, name, apiKey, baseUrl, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing API key ID' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (provider !== undefined) updateData.provider = provider;
    if (name !== undefined) updateData.name = name;
    if (apiKey !== undefined) updateData.apiKey = encodeApiKey(apiKey);
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedApiKey = await prisma.apiKey.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updatedApiKey,
      apiKey: updatedApiKey.apiKey.substring(0, 8) + '...',
    });
  } catch (error) {
    console.error('Failed to update API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}
