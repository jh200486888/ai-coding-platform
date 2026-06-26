import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSetting, setSetting } from "@/lib/db";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";
const SESSION_SECRET = "ai-coding-platform-admin-secret-2024";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function validateSession(session: string): boolean {
  try {
    const decoded = atob(session);
    const parts = decoded.split(":");
    if (parts.length < 2 || parts[0] !== "admin") return false;
    const timestamp = parseInt(parts[1], 10);
    if (isNaN(timestamp)) return false;
    return (Date.now() - timestamp) < SESSION_DURATION;
  } catch {
    return false;
  }
}

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return session ? validateSession(session) : false;
}

// GET - Get current username
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const username = (await getSetting("admin_username")) || DEFAULT_USERNAME;
  return NextResponse.json({ username });
}

// PUT - Change password/username
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { current_password, new_username, new_password } = body;

    // Verify current password
    const storedPassword = (await getSetting("admin_password")) || DEFAULT_PASSWORD;

    if (current_password !== storedPassword) {
      return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
    }

    // Update username if provided
    if (new_username && new_username.trim()) {
      await setSetting("admin_username", new_username.trim());
    }

    // Update password if provided
    if (new_password && new_password.length >= 6) {
      await setSetting("admin_password", new_password);
    } else if (new_password && new_password.length < 6) {
      return NextResponse.json({ error: "新密码至少需要6个字符" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "设置已保存" });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

// POST - same as PUT (for frontend compatibility)
export const POST = PUT;
