// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getSetting, run } from '@/lib/db';
import { DEFAULT_PROVIDER_URLS, DEFAULT_RUNTIME_CONFIG, DEFAULT_MODE_TOOLS, DEFAULT_MODEL_IDENTITY, DEFAULT_TOOL_NAME_ZH, DEFAULT_PATROL_CONFIG, DEFAULT_PROVIDER_MAX_TOKENS, DEFAULT_WS_PROVIDER_MAX_TOKENS } from '@/lib/config-defaults';

// GET: Load all platform configs
export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [providerUrls, advRaw, modeTools, modelIdentity, toolNameZh, patrolRaw, subAgentRaw, pmtRaw, wsPmtRaw] = await Promise.all([
      getSetting('provider_urls'),
      getSetting('advanced_config'),
      getSetting('mode_tool_whitelist'),
      getSetting('model_identity'),
      getSetting('tool_name_zh'),
      getSetting('patrol_config'),
      getSetting('sub_agent_configs'),
      getSetting('provider_max_tokens'),
      getSetting('ws_provider_max_tokens'),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        provider_urls: providerUrls ? JSON.parse(providerUrls) : DEFAULT_PROVIDER_URLS,
        advanced_config: advRaw ? JSON.parse(advRaw) : DEFAULT_RUNTIME_CONFIG,
        mode_tool_whitelist: modeTools ? JSON.parse(modeTools) : DEFAULT_MODE_TOOLS,
        model_identity: modelIdentity ? JSON.parse(modelIdentity) : DEFAULT_MODEL_IDENTITY,
        tool_name_zh: toolNameZh ? JSON.parse(toolNameZh) : DEFAULT_TOOL_NAME_ZH,
        patrol_config: patrolRaw ? JSON.parse(patrolRaw) : DEFAULT_PATROL_CONFIG,
        sub_agent_configs: subAgentRaw ? JSON.parse(subAgentRaw) : {},
        provider_max_tokens: pmtRaw ? JSON.parse(pmtRaw) : DEFAULT_PROVIDER_MAX_TOKENS,
        ws_provider_max_tokens: wsPmtRaw ? JSON.parse(wsPmtRaw) : DEFAULT_WS_PROVIDER_MAX_TOKENS,
        defaults: {
          provider_urls: DEFAULT_PROVIDER_URLS,
          runtime_config: DEFAULT_RUNTIME_CONFIG,
          mode_tools: DEFAULT_MODE_TOOLS,
          model_identity: DEFAULT_MODEL_IDENTITY,
          tool_name_zh: DEFAULT_TOOL_NAME_ZH,
          patrol_config: DEFAULT_PATROL_CONFIG,
          provider_max_tokens: DEFAULT_PROVIDER_MAX_TOKENS,
          ws_provider_max_tokens: DEFAULT_WS_PROVIDER_MAX_TOKENS,
        },
      },
    });
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
    const validKeys = ['provider_urls', 'mode_tool_whitelist', 'model_identity', 'tool_name_zh', 'patrol_config', 'sub_agent_configs', 'provider_max_tokens', 'ws_provider_max_tokens'];
    if (!validKeys.includes(key)) return NextResponse.json({ error: 'Invalid config key' }, { status: 400 });
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    // Upsert into settings table
    await run(
      `INSERT INTO settings (key, value, "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
      [key, jsonValue]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
