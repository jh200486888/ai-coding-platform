import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ai-coding-platform-jwt-secret-2026-secure'
);

const COOKIE_NAME = 'user_session';

// Routes that require user authentication
const PROTECTED_ROUTES = ['/', '/workspace'];
// Routes that should redirect to home if already logged in
const AUTH_ROUTES = ['/login'];
// API routes that require user authentication
const PROTECTED_API_ROUTES = ['/api/chat', '/api/conversations', '/api/workspace', '/api/speech-to-text', '/api/image-generate', '/api/image-gen'];
// Admin routes - keep existing admin auth separate
const ADMIN_ROUTES = ['/api/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  // Admin routes - use separate admin_session cookie (existing logic)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return NextResponse.next(); // Admin auth handled by its own API
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Redirect logged-in users away from login page
  if (AUTH_ROUTES.some(route => pathname === route)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Check protected API routes
  if (PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Check protected page routes
  if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

