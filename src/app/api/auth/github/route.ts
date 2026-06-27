import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { findUserByEmail, createUser, setSessionCookie, createAccessToken } from '@/lib/auth';

// GitHub OAuth callback: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url));

    const clientId = await getSetting('github_client_id');
    const clientSecret = await getSetting('github_client_secret');
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/login?error=github_not_configured', request.url));
    }

    // Step 2: Exchange code for access_token
    // POST https://github.com/login/oauth/access_token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL('/login?error=github_token_failed', request.url));
    }

    // Step 3: Use access_token to access the API
    // GET https://api.github.com/user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const ghUser = await userRes.json();

    // Get primary email (requires user:email scope)
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = await emailRes.json();
    const primaryEmail = (Array.isArray(emails) ? emails : [])
      .find((e: any) => e.primary && e.verified)?.email || ghUser.email;

    if (!primaryEmail) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    // Find or create user
    const existingUser = await findUserByEmail(primaryEmail);
    const user = existingUser ?? await createUser(primaryEmail, ghUser.name || ghUser.login, '', 'user');

    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await createAccessToken(authUser);
    await setSessionCookie(token);

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=github_oauth_failed', request.url));
  }
}
