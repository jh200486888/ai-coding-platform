import { hash, compare } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { queryOne } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ai-coding-platform-jwt-secret-2026-secure'
);

const ACCESS_TOKEN_EXPIRY = '7d';
const COOKIE_NAME = 'user_session';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return compare(password, hashed);
}

// Create JWT access token
export async function createAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ 
    id: user.id, 
    email: user.email, 
    name: user.name, 
    role: user.role 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

// Verify JWT token
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: (payload.name as string) || null,
      role: (payload.role as string) || 'user',
    };
  } catch {
    return null;
  }
}

// Get current user from cookie (server-side)
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME);
    if (!token) return null;
    return verifyToken(token.value);
  } catch {
    return null;
  }
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

// Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Find user by email
export async function findUserByEmail(email: string): Promise<AuthUser & { password: string } | null> {
  return queryOne<any>(
    'SELECT id, email, name, password, role FROM users WHERE email = $1',
    [email]
  );
}

// Create user
export async function createUser(email: string, name: string, password: string, role: string = 'user'): Promise<AuthUser> {
  const { randomUUID } = await import('crypto');
  const id = randomUUID();
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();
  
  await queryOne(
    `INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt") 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id, email, name, role`,
    [id, email, name || null, hashedPassword, role, now, now]
  );
  
  return { id, email, name: name || null, role };
}

