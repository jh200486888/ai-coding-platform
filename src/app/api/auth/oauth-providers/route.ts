import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";

// GET /api/auth/oauth-providers - Return which OAuth providers are configured + client_ids
export async function GET() {
  try {
    const [githubClientId, googleClientId, wechatAppId, smsAccessKeyId] = await Promise.all([
      getSetting("github_client_id"),
      getSetting("google_client_id"),
      getSetting("wechat_app_id"),
      getSetting("sms_access_key_id"),
    ]);

    return NextResponse.json({
      github: !!githubClientId,
      google: !!googleClientId,
      wechat: !!wechatAppId,
      sms: !!smsAccessKeyId,
      github_client_id: githubClientId || "",
      google_client_id: googleClientId || "",
      wechat_app_id: wechatAppId || "",
    });
  } catch {
    return NextResponse.json({
      github: false, google: false, wechat: false, sms: false,
      github_client_id: "", google_client_id: "", wechat_app_id: "",
    });
  }
}
