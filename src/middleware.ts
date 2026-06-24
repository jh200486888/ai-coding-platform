import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// Secret key for cookie signing (should match the one in login route)
const COOKIE_SECRET = process.env.ADMIN_COOKIE_SECRET || 'change-this-secret-in-production';

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function hashPassword(password: string): string {
  return createHash('sha256').update(password + COOKIE_SECRET).digest('hex');
}

function verifySessionToken(token: string): boolean {
  try {
    const payload = Buffer.from(token, 'base64').toString('utf-8');
    const parts = payload.split(':');
    if (parts.length !== 3) return false;
    
    const [username, timestamp, hash] = parts;
    const expectedHash = hashPassword(username + timestamp);
    
    // Check if hash matches
    if (hash !== expectedHash) return false;
    
    // Check if session is expired
    const sessionTime = parseInt(timestamp, 10);
    if (Date.now() - sessionTime > SESSION_DURATION) return false;
    
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to /admin routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_session');

    if (!token || !verifySessionToken(token.value)) {
      // Redirect to login page
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
