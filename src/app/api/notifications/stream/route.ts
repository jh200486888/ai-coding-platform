import { NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';

// In-memory notification queue (per-connection)
const listeners = new Map<string, Array<(event: string, data: any) => void>>();

export function broadcastNotification(event: string, data: any) {
  for (const [, callbacks] of listeners) {
    for (const cb of callbacks) {
      try { cb(event, data); } catch {}
    }
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return new Response('Unauthorized', { status: 401 });
  }

  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const callbacks: Array<(event: string, data: any) => void> = [];

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      callbacks.push(send);
      listeners.set(clientId, callbacks);

      // Send initial connection event
      send('connected', { clientId, timestamp: new Date().toISOString() });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          listeners.delete(clientId);
        }
      }, 30000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        listeners.delete(clientId);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
