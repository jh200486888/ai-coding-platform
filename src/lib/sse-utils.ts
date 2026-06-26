// Shared SSE stream parsing utility
// Extracted to avoid duplication across chat routes

export interface SSEEvent {
  type: string;
  content?: string;
  callId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  success?: boolean;
  summary?: string;
  conversation_id?: string;
  error?: string;
}

export type SSEHandler = (event: SSEEvent) => void;

/**
 * Parse SSE stream and dispatch events to handler
 * Returns the full text content accumulated from the stream
 */
export async function parseSSEStream(
  response: Response,
  handler: SSEHandler
): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  if (!reader) return fullContent;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const sseEvent of events) {
      const dataLine = sseEvent.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const jsonStr = dataLine.slice(6);
      if (!jsonStr.trim()) continue;
      try {
        const event: SSEEvent = JSON.parse(jsonStr);
        if (event.type === "content" && event.content) {
          fullContent += event.content;
        }
        handler(event);
      } catch {
        // Parse failed, skip malformed event
      }
    }
  }
  return fullContent;
}
