import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, setSessionCookie, createAccessToken } from '@/lib/auth';
import { claimAnonymousConversations } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await createAccessToken(authUser);
    await setSessionCookie(token);

    // Claim anonymous conversations for this user (sync mobile/desktop)
    try { await claimAnonymousConversations(user.id); } catch {}

    return NextResponse.json({ 
      success: true, 
      user: authUser
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
  }
}

