import { NextResponse } from 'next/server';
import { listApiKeys, upsertApiKey, deleteApiKey } from '@/lib/db';

// Simple encryption using base64 (in production, use proper encryption)
function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString('base64');
}

export async function GET() {
  try {
    const keys = await listApiKeys();
    // Mask the actual keys for security
    const masked = keys.map((k) => ({
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

export async function DELETE(request: Request) {
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
