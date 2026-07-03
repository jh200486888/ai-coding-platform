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

// Test API key connectivity
export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { provider, apiKey, baseUrl } = body;
    if (!provider || !apiKey) {
      return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 });
    }

    // Get default base URL
    const { DEFAULT_PROVIDER_URLS } = await import("@/lib/config-defaults");
    const defaultBaseUrl = DEFAULT_PROVIDER_URLS[provider] || `https://api.${provider}.com/v1`;
    const url = (baseUrl || defaultBaseUrl).replace(/\/+$/, "");

    // Decode base64-encoded API key
    const decodedKey = Buffer.from(apiKey, "base64").toString("utf-8");

    // Test with minimal chat/completions request (universal endpoint)
    // Use provider-appropriate test model
    const testModels: Record<string, string> = {
      openai: "gpt-3.5-turbo", zhipu: "glm-4-flash", qwen: "qwen-turbo",
      deepseek: "deepseek-chat", google: "gemini-2.0-flash", anthropic: "claude-3-haiku-20240307",
      moonshot: "moonshot-v1-8k", doubao: "doubao-pro-4k", yi: "yi-lightning",
      baidu: "ernie-speed-128k", spark: "generalv3.5", minimax: "abab5.5-chat",
    };
    const testModel = testModels[prov] || "gpt-3.5-turbo";

    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${decodedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      return NextResponse.json({ success: true, message: "✅ 连接成功，API Key 有效" });
    } else {
      const text = await res.text().catch(() => "");
      // 404 with invalid model but valid key still means auth works
      if ((res.status === 404 || res.status === 400) && (text.includes("model") || text.includes("does not exist") || text.includes("模型不存在"))) {
        return NextResponse.json({ success: true, message: "✅ Key 有效（该端点不支持测试模型，但认证通过）" });
      }
      return NextResponse.json({ success: false, message: `❌ HTTP ${res.status}: ${text.slice(0, 200)}` });
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message || String(e) }, { status: 500 });
  }
}
