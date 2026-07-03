import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { query, run } from '@/lib/db';

export async function GET(req: NextRequest) {
  const _authed = await isAdminAuthenticated();
  if (!_authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await query('SELECT * FROM workflow_templates ORDER BY usage_count DESC, name');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const _authed = await isAdminAuthenticated();
  if (!_authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { action } = body;

  if (action === 'create') {
    await run(
      `INSERT INTO workflow_templates (name, description, trigger_patterns, agent_type, steps, system_prompt)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [body.name, body.description || '', body.trigger_patterns || [], body.agent_type || 'coder', JSON.stringify(body.steps || []), body.system_prompt || '']
    );
    return NextResponse.json({ success: true });
  }

  if (action === 'update') {
    await run(
      `UPDATE workflow_templates SET name=$1, description=$2, trigger_patterns=$3, agent_type=$4, steps=$5::jsonb, system_prompt=$6, is_active=$7, updated_at=NOW() WHERE id=$8`,
      [body.name, body.description || '', body.trigger_patterns || [], body.agent_type || 'coder', JSON.stringify(body.steps || []), body.system_prompt || '', body.is_active !== false, body.id]
    );
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    await run('DELETE FROM workflow_templates WHERE id = $1', [body.id]);
    return NextResponse.json({ success: true });
  }

  if (action === 'toggle') {
    await run('UPDATE workflow_templates SET is_active = $1, updated_at = NOW() WHERE id = $2', [body.is_active, body.id]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
