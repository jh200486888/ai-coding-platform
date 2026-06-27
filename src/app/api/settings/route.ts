import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

// GET /api/settings?key=xxx - 获取单个设置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "缺少 key 参数" }, { status: 400 });
    }
    const value = await getSetting(key);
    return NextResponse.json({ key, value: value || "" });
  } catch (error) {
    console.error("Failed to get setting:", error);
    return NextResponse.json({ error: "获取设置失败" }, { status: 500 });
  }
}

// POST /api/settings - 更新单个设置 { key, value }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: "缺少 key 或 value" }, { status: 400 });
    }
    await setSetting(key, String(value));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to set setting:", error);
    return NextResponse.json({ error: "保存设置失败" }, { status: 500 });
  }
}
