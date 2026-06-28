import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';

export async function GET() {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const val = await getSetting('mcp_servers');
    const servers = val ? JSON.parse(val) : [];
    return NextResponse.json({ success: true, data: servers });
  } catch (error) {
    return NextResponse.json({ success: false, error: '获取MCP配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    await setSetting('mcp_servers', JSON.stringify(body.servers || []));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: '保存MCP配置失败' }, { status: 500 });
  }
}
