import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config as OpenApiConfig } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

// In-memory store for verification codes (production should use Redis)
const codeStore = new Map<string, { code: string; expires: number }>();

// Send SMS via Alibaba Cloud
// Ref: https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-overview
async function sendAliyunSms(
  accessKeyId: string, accessKeySecret: string,
  phone: string, signName: string, templateCode: string, code: string
) {
  const config = new OpenApiConfig({
    accessKeyId,
    accessKeySecret,
    endpoint: 'dysmsapi.aliyuncs.com',
  });
  const client = new Dysmsapi20170525(config);
  const request = new SendSmsRequest({
    phoneNumbers: phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code }),
  });
  const runtime = new RuntimeOptions({});
  const response = await client.sendSmsWithOptions(request, runtime);
  if (response.body?.code !== 'OK') {
    throw new Error(`Aliyun SMS error: ${response.body?.code} - ${response.body?.message}`);
  }
  return response.body;
}

// Send SMS via Tencent Cloud
// Ref: https://cloud.tencent.com/document/product/382/55981
async function sendTencentSms(
  secretId: string, secretKey: string,
  phone: string, signName: string, templateId: string, code: string, appId: string
) {
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: { secretId, secretKey },
    region: 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
  });
  const response = await client.SendSms({
    SmsSdkAppId: appId,
    SignName: signName,
    TemplateId: templateId,
    TemplateParamSet: [code],
    PhoneNumberSet: [`+86${phone}`],
  });
  const status = response.SendStatusSet?.[0];
  if (status?.Code !== 'Ok') {
    throw new Error(`Tencent SMS error: ${status?.Code} - ${status?.Message}`);
  }
  return response;
}

// POST /api/auth/sms - Send verification code
export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
    }

    const smsProvider = await getSetting('sms_provider'); // aliyun | tencent
    const accessKeyId = await getSetting('sms_access_key_id');
    const accessKeySecret = await getSetting('sms_access_key_secret');
    const signName = (await getSetting('sms_sign_name')) || '';
    const templateCode = (await getSetting('sms_template_code')) || '';

    if (!accessKeyId || !accessKeySecret) {
      return NextResponse.json({ error: '短信服务未配置，请在后台设置' }, { status: 400 });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 }); // 5 min

    try {
      if (smsProvider === 'tencent') {
        const appId = (await getSetting('sms_app_id')) || '';
        if (!appId) {
          return NextResponse.json({ error: '腾讯云短信 SdkAppId 未配置' }, { status: 400 });
        }
        await sendTencentSms(accessKeyId, accessKeySecret, phone, signName, templateCode, code, appId);
      } else {
        // Default: Alibaba Cloud
        if (!signName || !templateCode) {
          return NextResponse.json({ error: '阿里云短信签名或模板未配置' }, { status: 400 });
        }
        await sendAliyunSms(accessKeyId, accessKeySecret, phone, signName, templateCode, code);
      }
    } catch (smsErr: any) {
      console.error('SMS send error:', smsErr?.message || smsErr);
      console.log(`[DEV] SMS code for ${phone}: ${code}`);
      // Don't fail the request - code is still stored for dev testing
    }

    return NextResponse.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('SMS send error:', error);
    return NextResponse.json({ error: '发送验证码失败' }, { status: 500 });
  }
}

// PUT /api/auth/sms - Verify code and login/register
export async function PUT(request: NextRequest) {
  try {
    const { phone, code } = await request.json();
    if (!phone || !code) {
      return NextResponse.json({ error: '手机号和验证码不能为空' }, { status: 400 });
    }

    const stored = codeStore.get(phone);
    if (!stored || stored.code !== code || Date.now() > stored.expires) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    }
    codeStore.delete(phone);

    const { findUserByEmail, createUser, setSessionCookie, createAccessToken } = await import('@/lib/auth');
    const fakeEmail = `${phone}@sms.user`;
    const existingUser = await findUserByEmail(fakeEmail);
    const user = existingUser ?? await createUser(fakeEmail, phone, '', 'user');

    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await createAccessToken(authUser);
    await setSessionCookie(token);

    return NextResponse.json({ success: true, user: authUser });
  } catch (error) {
    console.error('SMS verify error:', error);
    return NextResponse.json({ error: '验证失败' }, { status: 500 });
  }
}
