import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = Math.min(parseInt(searchParams.get('size') || '20'), 100);
    const q = searchParams.get('q') || '';
    const offset = (page - 1) * size;

    let sql = 'SELECT id, category, content, tags, importance, keywords, "createdAt", "updatedAt" FROM user_memory';
    const params: any[] = [];
    if (q) {
      sql += ' WHERE content ILIKE $1 OR category ILIKE $1 OR tags ILIKE $1 OR keywords ILIKE $1';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY importance DESC, "updatedAt" DESC';
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(size, offset);

    const rows = await query(sql, params);
    const countSql = q ? 'SELECT COUNT(*) FROM user_memory WHERE content ILIKE $1 OR category ILIKE $1 OR tags ILIKE $1 OR keywords ILIKE $1' : 'SELECT COUNT(*) FROM user_memory';
    const countParams = q ? [`%${q}%`] : [];
    const countRow = await query(countSql, countParams);
    const total = parseInt(countRow[0]?.count || '0');

    return NextResponse.json({ success: true, data: rows, total, page, size });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids || (body.id ? [body.id] : []);
    if (!ids.length) return NextResponse.json({ success: false, error: 'No IDs provided' }, { status: 400 });
    await run(`DELETE FROM user_memory WHERE id = ANY($1::text[])`, [ids]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
