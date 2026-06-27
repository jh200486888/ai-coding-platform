import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { findUserByEmail, createUser, setSessionCookie, createAccessToken } from '@/lib/auth';

// Google OAuth 2.0 callback: https://developers.google.com/identity/protocols/oauth2/web-server
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url));

    const clientId = await getSetting('google_client_id');
    const clientSecret = await getSetting('google_client_secret');
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/login?error=google_not_configured', request.url));
    }

    const redirectUri = `${new URL(request.url).origin}/api/auth/google`;

    // Exchange authorization code for tokens
    // POST https://oauth2.googleapis.com/token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL('/login?error=google_token_failed', request.url));
    }

    // Get user info from userinfo endpoint
    // GET https://www.googleapis.com/oauth2/v2/userinfo
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await userRes.json();

    if (!gUser.email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    const existingUser = await findUserByEmail(gUser.email);
    const user = existingUser ?? await createUser(gUser.email, gUser.name || gUser.email.split('@')[0], '', 'user');

    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await createAccessToken(authUser);
    await setSessionCookie(token);

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=google_oauth_failed', request.url));
  }
}
