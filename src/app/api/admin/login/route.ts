import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';

// Admin credentials (hardcoded for simplicity)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Secret key for cookie signing (should be changed in production)
const COOKIE_SECRET = process.env.ADMIN_COOKIE_SECRET || 'change-this-secret-in-production';

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function hashPassword(password: string): string {
  return createHash('sha256').update(password + COOKIE_SECRET).digest('hex');
}

function createSessionToken(username: string): string {
  const timestamp = Date.now();
  const payload = `${username}:${timestamp}:${hashPassword(username + timestamp.toString())}`;
  return Buffer.from(payload).toString('base64');
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

// POST /api/admin/login - Login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // Verify credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // Create session token
    const token = createSessionToken(username);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000, // Convert to seconds
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '登录失败，请重试' },
      { status: 500 }
    );
  }
}

// GET /api/admin/session - Check session status
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session');

  if (!token || !verifySessionToken(token.value)) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true });
}

// DELETE /api/admin/logout - Logout
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return NextResponse.json({ success: true });
}

// Export for use in middleware
export { verifySessionToken };
