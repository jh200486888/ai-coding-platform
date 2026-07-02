import { NextRequest, NextResponse } from 'next/server';

import { query as dbQuery } from '@/lib/db';
// Using shared db pool

export async function GET() {
  try {
    const result = await dbQuery(
      'SELECT id, name, description, instructions, category, globs, always_apply, priority, is_active, token_estimate, resources, createdat, updatedat FROM agent_skills ORDER BY category, priority DESC'
    );
    return NextResponse.json({ skills: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, instructions, category, globs, always_apply, priority, is_active, resources } = body;
    if (!name || !description) return NextResponse.json({ error: 'name and description required' }, { status: 400 });
    
    const skillId = id || name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const tokenEst = instructions ? Math.ceil(instructions.length / 4) : 0;
    
    await dbQuery(
      `INSERT INTO agent_skills (id, name, description, instructions, category, globs, always_apply, priority, is_active, token_estimate, resources, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11::jsonb, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET 
         description=EXCLUDED.description, instructions=EXCLUDED.instructions,
         category=EXCLUDED.category, globs=EXCLUDED.globs, always_apply=EXCLUDED.always_apply,
         priority=EXCLUDED.priority, is_active=EXCLUDED.is_active, token_estimate=EXCLUDED.token_estimate,
         resources=EXCLUDED.resources, updatedat=NOW()`,
      [skillId, name, description || '', instructions || '', category || 'general',
       globs || [], always_apply || false, priority || 100, is_active !== false, tokenEst, JSON.stringify(resources || [])]
    );
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    
    const fields = ['name', 'description', 'instructions', 'category', 'globs', 'always_apply', 'priority', 'is_active', 'resources'];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    
    for (const field of fields) {
      if (body[field] !== undefined) {
        if (field === 'globs') {
          updates.push(`${field} = \$${paramIdx}::text[]`);
          values.push(body[field]);
        } else if (field === 'resources') {
          updates.push(`${field} = \$${paramIdx}::jsonb`);
          values.push(JSON.stringify(body[field]));
        } else {
          updates.push(`${field} = \$${paramIdx}`);
          values.push(body[field]);
        }
        paramIdx++;
      }
    }
    
    if (updates.length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    
    // Recalculate token_estimate if instructions changed
    if (body.instructions !== undefined) {
      updates.push(`token_estimate = \$${paramIdx}`);
      values.push(Math.ceil(body.instructions.length / 4));
      paramIdx++;
    }
    
    updates.push('updatedat = NOW()');
    values.push(id);
    
    await dbQuery(`UPDATE agent_skills SET ${updates.join(', ')} WHERE id = \$${paramIdx}`, values);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    
    await dbQuery('DELETE FROM agent_skills WHERE id = ', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
