import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { findUserByEmail, createUser, setSessionCookie, createAccessToken } from '@/lib/auth';

// WeChat OAuth callback: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
// Flow: authorization_code mode (3 steps)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url));

    const appId = await getSetting('wechat_app_id');
    const appSecret = await getSetting('wechat_app_secret');
    if (!appId || !appSecret) {
      return NextResponse.redirect(new URL('/login?error=wechat_not_configured', request.url));
    }

    // Step 2: Exchange code for access_token
    // GET https://api.weixin.qq.com/sns/oauth2/access_token
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token || !tokenData.openid) {
      return NextResponse.redirect(new URL('/login?error=wechat_token_failed', request.url));
    }

    // Step 3: Get user info via access_token
    // GET https://api.weixin.qq.com/sns/userinfo
    const userRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`
    );
    const wxUser = await userRes.json();

    // Use openid as unique identifier, generate virtual email
    const fakeEmail = `${tokenData.openid}@wechat.user`;
    const existingUser = await findUserByEmail(fakeEmail);
    const user = existingUser ?? await createUser(fakeEmail, wxUser.nickname || '微信用户', '', 'user');

    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await createAccessToken(authUser);
    await setSessionCookie(token);

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('WeChat OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=wechat_oauth_failed', request.url));
  }
}
