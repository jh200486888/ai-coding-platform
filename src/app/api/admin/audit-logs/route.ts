import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action') || '';
    const conversation_id = searchParams.get('conversation_id') || '';
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIdx = 1;

    if (action) {
      whereClauses.push('action = $' + paramIdx);
      params.push(action);
      paramIdx++;
    }
    if (conversation_id) {
      whereClauses.push('conversation_id = $' + paramIdx);
      params.push(conversation_id);
      paramIdx++;
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countResult = await query('SELECT COUNT(*) as total FROM audit_logs ' + whereSQL, params);
    const total = parseInt(countResult[0]?.total || '0');

    params.push(limit, offset);
    const rows = await query(
      'SELECT * FROM audit_logs ' + whereSQL + ' ORDER BY created_at DESC LIMIT $' + paramIdx + ' OFFSET $' + (paramIdx + 1),
      params
    );

    return NextResponse.json({ success: true, data: rows, total, page, limit });
  } catch (e: any) {
    console.error('[AuditLogs API] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
