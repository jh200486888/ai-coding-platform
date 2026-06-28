import { isAdminAuthenticated } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { listApiKeys, getApiKeyByProvider, upsertApiKey, deleteApiKey, query, queryOne, run } from '@/lib/db';
import { encodeApiKey } from '@/lib/ai-providers';
import { randomUUID } from 'crypto';

export async function GET() {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const apiKeys = await listApiKeys();
    const safeApiKeys = apiKeys.map((key: any) => ({
      ...key,
      apiKey: key.api_key_encrypted ? key.api_key_encrypted.substring(0, 8) + '...' : '',
    }));
    return NextResponse.json(safeApiKeys);
  } catch (error) {
    console.error('[API Keys] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { provider, name, apiKey, baseUrl } = body;
    if (!provider || !name || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const encodedApiKey = encodeApiKey(apiKey);
    const newKey = await upsertApiKey({ provider, provider_name: name, api_key_encrypted: encodedApiKey, base_url: baseUrl });
    return NextResponse.json({ ...newKey, api_key_encrypted: newKey.api_key_encrypted ? newKey.api_key_encrypted.substring(0, 8) + '...' : '' }, { status: 201 });
  } catch (error) {
    console.error('[API Keys] Failed:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing API key ID' }, { status: 400 });
    await deleteApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const body = await request.json();
    const { id, provider, name, apiKey, baseUrl, isActive } = body;
    if (!id) return NextResponse.json({ error: 'Missing API key ID' }, { status: 400 });
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (provider !== undefined) { updates.push(`provider = $${idx++}`); params.push(provider); }
    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (apiKey !== undefined) { updates.push(`"apiKey" = $${idx++}`); params.push(encodeApiKey(apiKey)); }
    if (baseUrl !== undefined) { updates.push(`"baseUrl" = $${idx++}`); params.push(baseUrl); }
    if (isActive !== undefined) { updates.push(`"isActive" = $${idx++}`); params.push(isActive); }
    if (updates.length > 0) {
      updates.push(`"updatedAt" = NOW()`);
      params.push(id);
      await run(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    }
    const updated = await queryOne('SELECT * FROM api_keys WHERE id = $1', [id]);
    return NextResponse.json({ ...updated, apiKey: updated?.apikey ? updated.apikey.substring(0, 8) + '...' : '' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}
