import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/auth';

// GET - fetch all design config (categories + templates)
export async function GET() {
  try {
    const categories = await query(
      'SELECT id, name, icon, sort_order, is_active FROM design_categories ORDER BY sort_order'
    );
    const templates = await query(
      'SELECT id, name, category_id, prompt, thumbnail, sort_order, is_active FROM design_templates ORDER BY sort_order'
    );
    return NextResponse.json({ categories, templates });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - create category or template
export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type } = body; // 'category' or 'template'

    if (type === 'category') {
      const { id, name, icon, sort_order } = body;
      if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
      await run(
        'INSERT INTO design_categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, icon=$3, sort_order=$4',
        [id, name, icon || 'Sparkles', sort_order || 0]
      );
      return NextResponse.json({ ok: true });
    }

    if (type === 'template') {
      const { id, name, category_id, prompt, thumbnail, sort_order } = body;
      if (!id || !name || !prompt) return NextResponse.json({ error: 'id, name and prompt required' }, { status: 400 });
      await run(
        'INSERT INTO design_templates (id, name, category_id, prompt, thumbnail, sort_order) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name=$2, category_id=$3, prompt=$4, thumbnail=$5, sort_order=$6',
        [id, name, category_id || 'all', prompt, thumbnail || '', sort_order || 0]
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'type must be category or template' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT - update category or template
export async function PUT(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type } = body;

    if (type === 'category') {
      const { id, name, icon, sort_order, is_active } = body;
      await run(
        'UPDATE design_categories SET name=$2, icon=$3, sort_order=$4, is_active=$5 WHERE id=$1',
        [id, name, icon, sort_order, is_active !== undefined ? is_active : true]
      );
      return NextResponse.json({ ok: true });
    }

    if (type === 'template') {
      const { id, name, category_id, prompt, thumbnail, sort_order, is_active } = body;
      await run(
        'UPDATE design_templates SET name=$2, category_id=$3, prompt=$4, thumbnail=$5, sort_order=$6, is_active=$7 WHERE id=$1',
        [id, name, category_id, prompt, thumbnail, sort_order, is_active !== undefined ? is_active : true]
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'type must be category or template' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE - delete category or template
export async function DELETE(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });

    if (type === 'category') {
      await run('DELETE FROM design_categories WHERE id=$1', [id]);
    } else if (type === 'template') {
      await run('DELETE FROM design_templates WHERE id=$1', [id]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

