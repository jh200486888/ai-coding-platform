import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    const categories = await query('SELECT id, name, icon, sort_order, is_active FROM design_categories ORDER BY sort_order');
    const templates = await query('SELECT id, name, category_id, prompt, thumbnail, sort_order, is_active FROM design_templates ORDER BY sort_order');
    const tools = await query('SELECT id, name, icon, sort_order, is_active FROM design_tools ORDER BY sort_order');
    const suggestions = await query('SELECT id, text, sort_order, is_active FROM design_suggestions ORDER BY sort_order');
    return NextResponse.json({ categories, templates, tools, suggestions });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { type } = body;
    if (type === 'category') {
      const { id, name, icon, sort_order } = body;
      if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
      await run('INSERT INTO design_categories (id, name, icon, sort_order) VALUES (, , , ) ON CONFLICT (id) DO UPDATE SET name=, icon=, sort_order=', [id, name, icon || 'Sparkles', sort_order || 0]);
    } else if (type === 'template') {
      const { id, name, category_id, prompt, thumbnail, sort_order } = body;
      if (!id || !name || !prompt) return NextResponse.json({ error: 'id, name and prompt required' }, { status: 400 });
      await run('INSERT INTO design_templates (id, name, category_id, prompt, thumbnail, sort_order) VALUES (, , , , , ) ON CONFLICT (id) DO UPDATE SET name=, category_id=, prompt=, thumbnail=, sort_order=', [id, name, category_id || 'all', prompt, thumbnail || '', sort_order || 0]);
    } else if (type === 'tool') {
      const { id, name, icon, sort_order } = body;
      if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
      await run('INSERT INTO design_tools (id, name, icon, sort_order) VALUES (, , , ) ON CONFLICT (id) DO UPDATE SET name=, icon=, sort_order=', [id, name, icon || 'Shapes', sort_order || 0]);
    } else if (type === 'suggestion') {
      const { id, text, sort_order } = body;
      if (!id || !text) return NextResponse.json({ error: 'id and text required' }, { status: 400 });
      await run('INSERT INTO design_suggestions (id, text, sort_order) VALUES (, , ) ON CONFLICT (id) DO UPDATE SET text=, sort_order=', [id, text, sort_order || 0]);
    } else { return NextResponse.json({ error: 'invalid type' }, { status: 400 }); }
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { type } = body;
    if (type === 'category') {
      const { id, name, icon, sort_order, is_active } = body;
      await run('UPDATE design_categories SET name=, icon=, sort_order=, is_active= WHERE id=', [id, name, icon, sort_order, is_active !== undefined ? is_active : true]);
    } else if (type === 'template') {
      const { id, name, category_id, prompt, thumbnail, sort_order, is_active } = body;
      await run('UPDATE design_templates SET name=, category_id=, prompt=, thumbnail=, sort_order=, is_active= WHERE id=', [id, name, category_id, prompt, thumbnail, sort_order, is_active !== undefined ? is_active : true]);
    } else if (type === 'tool') {
      const { id, name, icon, sort_order, is_active } = body;
      await run('UPDATE design_tools SET name=, icon=, sort_order=, is_active= WHERE id=', [id, name, icon, sort_order, is_active !== undefined ? is_active : true]);
    } else if (type === 'suggestion') {
      const { id, text, sort_order, is_active } = body;
      await run('UPDATE design_suggestions SET text=, sort_order=, is_active= WHERE id=', [id, text, sort_order, is_active !== undefined ? is_active : true]);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });
    const TABLE_MAP: Record<string, string> = { category: 'design_categories', template: 'design_templates', tool: 'design_tools', suggestion: 'design_suggestions' };
    const table = TABLE_MAP[type];
    if (!table) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    await run(`DELETE FROM ${table} WHERE id=`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

