// @ts-nocheck
/**
 * Real-time notification emitter - broadcasts events to connected SSE clients
 * Used by onToolExecutionEnd, scheduled tasks, sub-agent completion, etc.
 */

// Import broadcastNotification from the SSE route
let broadcastFn: ((event: string, data: any) => void) | null = null;

async function getBroadcast() {
  if (!broadcastFn) {
    try {
      const mod = await import('@/app/api/notifications/stream/route');
      broadcastFn = mod.broadcastNotification;
    } catch {
      // Fallback: noop if module not loaded yet
      broadcastFn = () => {};
    }
  }
  return broadcastFn!;
}

export async function emitNotification(event: string, data: any) {
  try {
    const broadcast = await getBroadcast();
    broadcast(event, data);
  } catch {}
}

// Convenience functions for common events
export async function notifyTaskComplete(taskId: string, title: string, result?: string) {
  await emitNotification('task_complete', { taskId, title, result: result?.slice(0, 200), timestamp: Date.now() });
}

export async function notifyTaskFailed(taskId: string, title: string, error: string) {
  await emitNotification('task_failed', { taskId, title, error: error.slice(0, 200), timestamp: Date.now() });
}

export async function notifyDocumentGenerated(docId: string, title: string, type: string) {
  await emitNotification('document_generated', { docId, title, type, timestamp: Date.now() });
}

export async function notifySubAgentComplete(agentType: string, taskId: string, duration: number) {
  await emitNotification('subagent_complete', { agentType, taskId, duration, timestamp: Date.now() });
}
