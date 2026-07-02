import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { listApiKeys, upsertApiKey, deleteApiKey, queryOne, run } from '@/lib/db';

function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString('base64');
}

export async function GET() {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const keys = await listApiKeys();
    const masked = keys.map((k: any) => ({
      ...k,
      api_key_encrypted: k.api_key_encrypted
        ? '***' + k.api_key_encrypted.slice(-4)
        : '',
    }));
    return NextResponse.json({ data: masked });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { provider, provider_name, api_key, base_url, is_active } = body;

    if (!provider || !provider_name || !api_key) {
      return NextResponse.json(
        { error: 'provider, provider_name, and api_key are required' },
        { status: 400 }
      );
    }

    const encrypted = simpleEncrypt(api_key);
    const result = await upsertApiKey({
      provider,
      provider_name,
      api_key_encrypted: encrypted,
      base_url,
      is_active,
    });

    return NextResponse.json({
      data: {
        ...result,
        api_key_encrypted: '***' + encrypted.slice(-4),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { id, api_key, base_url, provider_name, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (api_key !== undefined) {
      updates.push(`"apiKey" = $${idx++}`);
      params.push(simpleEncrypt(api_key));
    }
    if (base_url !== undefined) {
      updates.push(`"baseUrl" = $${idx++}`);
      params.push(base_url);
    }
    if (provider_name !== undefined) {
      updates.push(`"name" = $${idx++}`);
      params.push(provider_name);
    }
    if (is_active !== undefined) {
      updates.push(`"isActive" = $${idx++}`);
      params.push(is_active);
    }

    if (updates.length > 0) {
      updates.push(`"updatedAt" = NOW()`);
      params.push(id);
      await run(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    }

    const updated = await queryOne('SELECT * FROM api_keys WHERE id = $1', [id]);
    const masked = {
      ...updated,
      api_key_encrypted: updated?.api_key_encrypted ? '***' + updated.apiKey.slice(-4) : '',
    };
    return NextResponse.json({ data: masked });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await deleteApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
