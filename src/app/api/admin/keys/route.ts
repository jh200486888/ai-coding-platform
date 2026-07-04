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
    console.log("[KEY-TEST] body:", JSON.stringify(body));
    const { id, provider } = body;

    // Look up key from DB
    const { query: dbQuery } = await import("@/lib/db");
    let rows: any[] = [];
    if (id) {
      rows = await dbQuery('SELECT provider, "apiKey", "baseUrl" FROM api_keys WHERE id = $1', [id]);
    } else if (provider) {
      rows = await dbQuery('SELECT provider, "apiKey", "baseUrl" FROM api_keys WHERE provider = $1 AND "isActive" = true', [provider]);
    }

    console.log("[KEY-TEST] found rows:", rows?.length || 0);

    if (!rows || rows.length === 0 || !rows[0].apiKey) {
      return NextResponse.json({ success: false, message: "\u672a\u627e\u5230 API Key (id=" + (id || "none") + ")" });
    }

    const row = rows[0];
    const decodedKey = Buffer.from(row.apiKey, "base64").toString("utf-8");
    const prov = row.provider || provider || "unknown";

    console.log("[KEY-TEST] testing provider:", prov, "key_len:", decodedKey.length);

    const { DEFAULT_PROVIDER_URLS } = await import("@/lib/config-defaults");
    const defaultBaseUrl = DEFAULT_PROVIDER_URLS[prov] || ("https://api." + prov + ".com/v1");
    const url = (row.baseUrl || defaultBaseUrl).replace(/\/+$/, "");

    const testModels: Record<string, string> = {
      openai: "gpt-3.5-turbo", zhipu: "glm-4-flash", qwen: "qwen-turbo",
      deepseek: "deepseek-chat", google: "gemini-2.0-flash", anthropic: "claude-3-haiku-20240307",
      moonshot: "moonshot-v1-8k", doubao: "doubao-pro-4k", yi: "yi-lightning",
      baidu: "ernie-speed-128k", spark: "generalv3.5", minimax: "abab5.5-chat",
    };
    const testModel = testModels[prov] || "gpt-3.5-turbo";

    console.log("[KEY-TEST] url:", url, "model:", testModel);

    const res = await fetch(url + "/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + decodedKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: testModel, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text().catch(() => "");
    console.log("[KEY-TEST] response status:", res.status, "body:", text.substring(0, 150));

    if (res.ok) {
      return NextResponse.json({ success: true, message: "\u2705 \u8fde\u63a5\u6210\u529f\uff0cAPI Key \u6709\u6548" });
    }
    if ((res.status === 404 || res.status === 400) && (text.includes("model") || text.includes("does not exist") || text.includes("\u6a21\u578b"))) {
      return NextResponse.json({ success: true, message: "\u2705 Key \u6709\u6548\uff0c\u8ba4\u8bc1\u901a\u8fc7" });
    }
    return NextResponse.json({ success: false, message: "HTTP " + res.status + ": " + text.substring(0, 200) });
  } catch (e: any) {
    console.error("[KEY-TEST] ERROR:", e.message, e.stack);
    return NextResponse.json({ success: false, message: "Error: " + (e.message || String(e)) }, { status: 500 });
  }
}