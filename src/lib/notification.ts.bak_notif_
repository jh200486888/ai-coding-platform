// @ts-nocheck
/**
 * Notification Service - Send alerts to IM channels (DingTalk, Feishu, Custom Webhook)
 */
import { loadNotificationConfig } from './config-defaults';
import { getSetting } from './db';

interface AlertPayload {
  title: string;
  content: string;
  level?: 'info' | 'warning' | 'error';
  timestamp?: string;
}

async function sendDingtalk(webhook: any, payload: AlertPayload): Promise<boolean> {
  try {
    const { url, secret } = webhook;
    if (!url) return false;

    let finalUrl = url;
    if (secret) {
      const crypto = await import('crypto');
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const hmac = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
      const sign = encodeURIComponent(hmac);
      finalUrl = `${url}&timestamp=${timestamp}&sign=${sign}`;
    }

    const res = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: payload.title,
          text: `### ${payload.level === 'error' ? '🚨' : payload.level === 'warning' ? '⚠️' : 'ℹ️'} ${payload.title}\n\n${payload.content}\n\n> ${payload.timestamp || new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('[Notification] DingTalk send failed:', e);
    return false;
  }
}

async function sendFeishu(webhook: any, payload: AlertPayload): Promise<boolean> {
  try {
    const { url } = webhook;
    if (!url) return false;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: payload.title },
            template: payload.level === 'error' ? 'red' : payload.level === 'warning' ? 'orange' : 'blue',
          },
          elements: [
            { tag: 'markdown', content: payload.content },
            { tag: 'note', elements: [{ tag: 'plain_text', content: payload.timestamp || new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }] },
          ],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('[Notification] Feishu send failed:', e);
    return false;
  }
}

async function sendCustom(webhook: any, payload: AlertPayload): Promise<boolean> {
  try {
    const { url } = webhook;
    if (!url) return false;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error('[Notification] Custom webhook failed:', e);
    return false;
  }
}

export async function sendAlert(payload: AlertPayload): Promise<{ sent: number; failed: number }> {
  const config = await loadNotificationConfig(getSetting);
  if (!config.enabled) return { sent: 0, failed: 0 };

  const enabledWebhooks = config.webhooks.filter((w: any) => w.enabled && w.url);
  let sent = 0, failed = 0;

  for (const webhook of enabledWebhooks) {
    let success = false;
    switch (webhook.type) {
      case 'dingtalk': success = await sendDingtalk(webhook, payload); break;
      case 'feishu': success = await sendFeishu(webhook, payload); break;
      case 'custom': success = await sendCustom(webhook, payload); break;
    }
    if (success) sent++; else failed++;
  }

  return { sent, failed };
}
