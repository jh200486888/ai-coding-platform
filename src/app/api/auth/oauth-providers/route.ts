import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

// GET /api/auth/oauth-providers - Return which OAuth providers are configured
export async function GET() {
  try {
    const [githubClientId, googleClientId, wechatAppId, smsAccessKeyId] = await Promise.all([
      getSetting('github_client_id'),
      getSetting('google_client_id'),
      getSetting('wechat_app_id'),
      getSetting('sms_access_key_id'),
    ]);

    return NextResponse.json({
      github: !!githubClientId,
      google: !!googleClientId,
      wechat: !!wechatAppId,
      sms: !!smsAccessKeyId,
    });
  } catch {
    return NextResponse.json({ github: false, google: false, wechat: false, sms: false });
  }
}
