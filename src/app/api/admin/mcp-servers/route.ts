import { NextRequest, NextResponse } from 'next/server';
import { getSetting, query, run } from '@/lib/db';

interface McpServer {
  id: string;
  name: string;
  url: string;
  type: 'http' | 'sse';
  enabled: boolean;
}

// GET /api/admin/mcp-servers - 获取 MCP 服务器列表
export async function GET() {
  try {
    const data = await getSetting('mcp_servers');
    const servers: McpServer[] = data ? JSON.parse(data) : [];
    return NextResponse.json({ data: servers });
  } catch (error) {
    console.error('Failed to get MCP servers:', error);
    return NextResponse.json({ success: false, error: '获取 MCP 服务器失败' }, { status: 500 });
  }
}

// POST /api/admin/mcp-servers - 保存 MCP 服务器配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { servers } = body as { servers: McpServer[] };

    if (!Array.isArray(servers)) {
      return NextResponse.json({ success: false, error: '无效的数据格式' }, { status: 400 });
    }

    // 为每个服务器生成 ID
    const serversWithId = servers.map((s, i) => ({
      id: s.id || `server-${Date.now()}-${i}`,
      name: s.name,
      url: s.url,
      type: s.type === 'sse' ? 'sse' : 'http',
      enabled: Boolean(s.enabled),
    }));

    const value = JSON.stringify(serversWithId);

    // 检查是否存在
    const existing = await query<{ key: string }>('SELECT key FROM settings WHERE key = $1', ['mcp_servers']);
    
    if (existing.length > 0) {
      await run('UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2', [value, 'mcp_servers']);
    } else {
      await run('INSERT INTO settings (key, value) VALUES ($1, $2)', ['mcp_servers', value]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save MCP servers:', error);
    return NextResponse.json({ success: false, error: '保存 MCP 服务器失败' }, { status: 500 });
  }
}
