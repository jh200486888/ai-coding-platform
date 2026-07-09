// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getSetting, run } from '@/lib/db';
import { cacheDelete } from '@/lib/cache';
import { DEFAULT_PROVIDER_URLS, DEFAULT_RUNTIME_CONFIG, DEFAULT_MODE_TOOLS, DEFAULT_MODEL_IDENTITY, DEFAULT_TOOL_NAME_ZH, DEFAULT_PATROL_CONFIG, DEFAULT_PROVIDER_MAX_TOKENS, DEFAULT_WS_PROVIDER_MAX_TOKENS, DEFAULT_TOOL_SAFETY_TIERS, DEFAULT_SSH_SAFE_COMMANDS, DEFAULT_NOTIFICATION_CONFIG } from '@/lib/config-defaults';

const ALL_VALID_KEYS = [
  'provider_urls', 'mode_tool_whitelist', 'model_identity', 'tool_name_zh',
  'patrol_config', 'sub_agent_configs', 'provider_max_tokens', 'ws_provider_max_tokens',
  'tool_safety_tiers', 'ssh_safe_commands', 'notification_config', 'proactive_rules', 'proactive_enabled',
];

const DEFAULTS_MAP: Record<string, any> = {
  provider_urls: DEFAULT_PROVIDER_URLS,
  advanced_config: DEFAULT_RUNTIME_CONFIG,
  mode_tool_whitelist: DEFAULT_MODE_TOOLS,
  model_identity: DEFAULT_MODEL_IDENTITY,
  tool_name_zh: DEFAULT_TOOL_NAME_ZH,
  patrol_config: DEFAULT_PATROL_CONFIG,
  provider_max_tokens: DEFAULT_PROVIDER_MAX_TOKENS,
  ws_provider_max_tokens: DEFAULT_WS_PROVIDER_MAX_TOKENS,
  tool_safety_tiers: DEFAULT_TOOL_SAFETY_TIERS,
  ssh_safe_commands: DEFAULT_SSH_SAFE_COMMANDS,
  notification_config: DEFAULT_NOTIFICATION_CONFIG,
};

// GET: Load all configs, or a single key via ?key=xxx
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Single-key mode: ?key=tool_safety_tiers
  const singleKey = request.nextUrl.searchParams.get('key');
  if (singleKey && ALL_VALID_KEYS.includes(singleKey)) {
    try {
      const raw = await getSetting(singleKey);
      const defaultVal = DEFAULTS_MAP[singleKey] || {};
      const value = raw ? raw : JSON.stringify(defaultVal);
      return NextResponse.json({ success: true, key: singleKey, value });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
  }

  // Bulk mode: return all configs
  try {
    const keys = ['provider_urls', 'advanced_config', 'mode_tool_whitelist', 'model_identity',
      'tool_name_zh', 'patrol_config', 'sub_agent_configs', 'provider_max_tokens',
      'ws_provider_max_tokens', 'tool_safety_tiers', 'ssh_safe_commands', 'notification_config'];
    const values = await Promise.all(keys.map(k => getSetting(k)));

    const data: Record<string, any> = {};
    const defaults: Record<string, any> = {};
    keys.forEach((k, i) => {
      data[k] = values[i] ? JSON.parse(values[i]) : (DEFAULTS_MAP[k] || {});
      defaults[k] = DEFAULTS_MAP[k] || {};
    });

    return NextResponse.json({ success: true, data, defaults });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST: Save a specific config key
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { key, value } = body;
    if (!ALL_VALID_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid config key: ' + key + '. Valid keys: ' + ALL_VALID_KEYS.join(', ') }, { status: 400 });
    }
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await run(
      `INSERT INTO settings (key, value, "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
      [key, jsonValue]
    );
    cacheDelete(`setting:${key}`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
