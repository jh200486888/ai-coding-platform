import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAllSettings, getSetting, setSetting } from '@/lib/db';

// GET /api/admin/settings - 获取所有设置
export async function GET() {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const settings = await getAllSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ success: false, error: '获取设置失败' }, { status: 500 });
  }
}

// PUT /api/admin/settings - 更新设置
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: '缺少 key 或 value' }, { status: 400 });
    }

    await setSetting(key, String(value));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set setting:', error);
    return NextResponse.json({ success: false, error: '保存设置失败' }, { status: 500 });
  }
}

// POST /api/admin/settings - 更新单个设置 (兼容 { key, value } 格式)
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    
    // Handle { key, value } format from frontend
    if (body.key !== undefined && body.value !== undefined) {
      await setSetting(body.key, String(body.value));
      return NextResponse.json({ success: true });
    }
    
    // Handle batch format { key1: value1, key2: value2 }
    const settings = body as Record<string, string>;
    for (const [key, value] of Object.entries(settings)) {
      await setSetting(key, String(value));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set settings:', error);
    return NextResponse.json({ success: false, error: '保存设置失败' }, { status: 500 });
  }
}
