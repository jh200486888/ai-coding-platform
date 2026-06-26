import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSetting } from "@/lib/db";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";
const SESSION_SECRET = "ai-coding-platform-admin-secret-2024";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const mixed = SESSION_SECRET.split("").map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ timestamp.charCodeAt(i % timestamp.length))
  ).join("");
  return btoa(`admin:${timestamp}:${mixed.slice(0, 16)}`);
}

// POST /api/admin/login - Login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    // Read credentials from database
    const storedUsername = (await getSetting("admin_username")) || DEFAULT_USERNAME;
    const storedPassword = (await getSetting("admin_password")) || DEFAULT_PASSWORD;

    // Verify credentials
    if (username !== storedUsername || password !== storedPassword) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // Create session token
    const token = createSessionToken();

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION / 1000,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "登录失败，请重试" },
      { status: 500 }
    );
  }
}

// GET /api/admin/session - Check session status
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session");

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const decoded = atob(token.value);
    const parts = decoded.split(":");
    if (parts.length < 2 || parts[0] !== "admin") {
      return NextResponse.json({ authenticated: false });
    }

    const timestamp = parseInt(parts[1], 10);
    if (isNaN(timestamp)) {
      return NextResponse.json({ authenticated: false });
    }

    const now = Date.now();
    if ((now - timestamp) >= SESSION_DURATION) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

// DELETE /api/admin/logout - Logout
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  return NextResponse.json({ success: true });
}
