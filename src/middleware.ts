import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 简单的 session 验证（不使用 crypto 模块，兼容 Edge Runtime）
// Session 格式：admin_timestamp，验证时检查时间戳是否在24小时内
const SESSION_SECRET = 'ai-coding-platform-admin-secret-2024'
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000 // 24小时

// 简单的 session 生成函数（使用 Web Crypto API 的替代方案）
function generateSession(): string {
  const timestamp = Date.now().toString()
  // 简单的混淆：将 secret 和 timestamp 混合
  const mixed = SESSION_SECRET.split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ timestamp.charCodeAt(i % timestamp.length))
  ).join('')
  // 使用 base64 编码
  const session = btoa(`admin:${timestamp}:${mixed.slice(0, 16)}`)
  return session
}

function validateSession(session: string): boolean {
  try {
    const decoded = atob(session)
    const parts = decoded.split(':')
    if (parts.length < 2 || parts[0] !== 'admin') return false
    
    const timestamp = parseInt(parts[1], 10)
    if (isNaN(timestamp)) return false
    
    // 检查是否在24小时内
    const now = Date.now()
    return (now - timestamp) < SESSION_MAX_AGE
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 只保护 /admin 路径（排除 /admin/login 和 /api/admin/login）
  if (pathname.startsWith('/admin') && 
      pathname !== '/admin/login' && 
      !pathname.startsWith('/api/admin/login')) {
    
    const session = request.cookies.get('admin_session')?.value
    
    if (!session || !validateSession(session)) {
      // 未登录，重定向到登录页
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
