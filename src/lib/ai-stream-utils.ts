// ============================================================
// AI SDK Stream 处理公共工具
// 供 /api/chat 和 /api/workspace/chat 共用，避免重复
// ============================================================

export interface StreamCallbacks {
  /** 流结束后保存 assistant 消息 */
  onContentComplete?: (fullContent: string) => Promise<void>;
}

/**
 * 根据 streamText 的 result 创建 SSE Response
 * 统一处理 text-delta / tool-call / tool-result / error / reasoning 事件
 */
export function createSSEResponse(
  result: any,
  conversationId: string,
  toolNameMap: Record<string, string>,
  callbacks?: StreamCallbacks,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (data: Uint8Array) => {
        try { controller.enqueue(data); } catch {}
      };
      const safeClose = () => {
        try { controller.close(); } catch {}
      };

      try {
        let fullContent = '';

        for await (const event of result.fullStream) {
          const eventType = event.type as string;

          // reasoning / reasoning-delta
          if (eventType === 'reasoning' || eventType === 'reasoning-delta') {
            const reasoningText =
              (event as any).text || (event as any).textDelta || (event as any).delta || '';
            if (reasoningText) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'reasoning', content: reasoningText, conversation_id: conversationId })}\n\n`,
                ),
              );
            }
          }

          switch (event.type) {
            case 'text-delta': {
              const text = (event as any).text || '';
              if (text) {
                fullContent += text;
                safeEnqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'content', content: text, conversation_id: conversationId })}\n\n`,
                  ),
                );
              }
              break;
            }

            case 'tool-call': {
              const toolName = (event as any).toolName || 'unknown';
              const callId = (event as any).toolCallId || '';
              const args = (event as any).input || {};
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-start',
                    toolName: toolNameMap[toolName] || toolName,
                    callId,
                    args,
                  })}\n\n`,
                ),
              );
              break;
            }

            case 'tool-result': {
              const toolName = (event as any).toolName || 'unknown';
              const callId = (event as any).toolCallId || '';
              const rawOutput = (event as any).output;
              let output = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);

              // searchWeb 结果里提取 sources
              if (toolName === 'searchWeb') {
                try {
                  const parsed =
                    typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
                  if (parsed?.sources?.length > 0) {
                    safeEnqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'sources',
                          sources: parsed.sources,
                          conversation_id: conversationId,
                        })}\n\n`,
                      ),
                    );
                    output = parsed.text || output;
                  }
                } catch {}
              }

              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-result',
                    toolName,
                    callId,
                    success: !output.startsWith('\u274c'),
                    summary: output.slice(0, 50),
                  })}\n\n`,
                ),
              );

              // 不再自动推送工具完成提示，前端已有状态条显示
              break;
            }

            case 'error': {
              const error = (event as any).error;
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    error: error?.message || 'Unknown error',
                  })}\n\n`,
                ),
              );
              break;
            }
          }
        }

        // 流完成，回调保存 assistant 消息
        if (fullContent && callbacks?.onContentComplete) {
          try {
            await callbacks.onContentComplete(fullContent);
          } catch {}
        }

        safeEnqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId })}\n\n`,
          ),
        );
        safeClose();
      } catch (error: any) {
        safeEnqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: error.message || 'Stream error',
            })}\n\n`,
          ),
        );
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
