import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, event, payload } = body;

    // Validate webhook secret
    const webhookConfig = await getSetting('webhook_config');
    const config = webhookConfig ? JSON.parse(webhookConfig) : { enabled: false, secret: '' };
    if (!config.enabled) return NextResponse.json({ error: 'Webhook triggers disabled' }, { status: 403 });
    if (!config.secret || secret !== config.secret) return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });

    // Create a chat message to trigger agent
    const taskDescription = payload?.description || payload?.message || `[Webhook Event: ${event || 'unknown'}] ${JSON.stringify(payload || {}).slice(0, 500)}`;

    // Call internal chat API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://127.0.0.1:5000';
    const chatRes = await fetch(baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: taskDescription }],
        model: payload?.model || 'deepseek-chat',
        mode: payload?.mode || 'coding',
      }),
    });

    if (chatRes.ok) {
      // Read SSE stream to get result
      const reader = chatRes.body?.getReader();
      let result = '';
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
        }
      }
      return NextResponse.json({ success: true, event, resultLength: result.length });
    }

    return NextResponse.json({ success: false, error: 'Chat API returned ' + chatRes.status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
