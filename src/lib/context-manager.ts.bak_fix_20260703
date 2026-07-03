import { DEFAULT_PROVIDER_URLS } from '@/lib/config-defaults';
// @ts-nocheck
/**
 * Context Window Management - Smart Token Trimming
 * Prevents context overflow by intelligently managing message history.
 * 
 * Strategy (multi-layer):
 * 1. Individual tool output truncation (aggressive for old messages)
 * 2. AI-powered summarization of old conversation turns
 * 3. Fallback extraction if AI summarization fails
 * 4. Hard trim as last resort (keep last N turns only)
 */
import { generateText } from 'ai';
import { getApiKeyByProvider, getModelConfig, getSetting } from '@/lib/db';
import { logger } from './logger';

// Provider base URL map (fallback)
const PROVIDER_BASE_URLS: Record<string, string> = DEFAULT_PROVIDER_URLS;;

// ============ Model Context Window Sizes (tokens) ============
function getModelContextWindow(modelId: string): number {
  if (!modelId) return 32000;
  const m = modelId.toLowerCase();
  // OpenAI
  if (m.includes('gpt-4o') || m.includes('gpt-4-turbo')) return 128000;
  if (m.includes('gpt-4')) return m.includes('32k') ? 32000 : 128000;
  if (m.includes('gpt-3.5')) return 16385;
  if (m.includes('o1') || m.includes('o3')) return 200000;
  // Anthropic
  if (m.includes('claude-3') || m.includes('claude-4')) return 200000;
  if (m.includes('claude-sonnet-4')) return 200000;
  // Google
  if (m.includes('gemini-2')) return 1000000;
  if (m.includes('gemini')) return 1000000;
  // DeepSeek
  if (m.includes('deepseek-v3') || m.includes('deepseek-v4')) return 64000;
  if (m.includes('deepseek-r1') || m.includes('reasoner')) return 64000;
  if (m.includes('deepseek')) return 64000;
  // Qwen
  if (m.includes('qwen-max') || m.includes('qwen-plus')) return 131072;
  if (m.includes('qwen')) return 32000;
  // Zhipu
  if (m.includes('glm-4') || m.includes('glm-5')) return 128000;
  // Kimi
  if (m.includes('kimi') || m.includes('moonshot')) return 128000;
  // Doubao
  if (m.includes('doubao') || m.includes('seed')) return 32000;
  // Default
  return 32000;
}

// ============ Token Estimation ============
export function estimateTokens(messages: any[]): number {
  try {
    return Math.ceil(JSON.stringify(messages).length / 3.5);
  } catch {
    return 0;
  }
}

// ============ Extract Model ID ============
function extractModelId(model: any): string {
  if (!model) return '';
  if (typeof model === 'string') return model;
  return model.modelId || (model as any).id || '';
}

// ============ MAIN: Smart Trim Messages ============
/**
 * Intelligently trim messages to fit within model's context budget.
 * 
 * Returns { messages, wasTrimmed } where wasTrimmed indicates if trimming occurred.
 * 
 * Strategy layers:
 * 1. Truncate individual oversized tool outputs (always applied)
 * 2. If still over budget: summarize old messages with AI
 * 3. If AI summarization fails: extract key info manually
 * 4. If still over budget: hard trim (keep last N turns)
 */
export async function smartTrimMessages(
  messages: any[],
  model: any,
  options?: { reservedForOutput?: number; forceTrim?: boolean }
): Promise<{ messages: any[]; wasTrimmed: boolean }> {
  const modelId = extractModelId(model);
  const contextWindow = getModelContextWindow(modelId);
  const reservedForOutput = options?.reservedForOutput || Math.min(16000, Math.floor(contextWindow * 0.15));
  const budget = contextWindow - reservedForOutput;
  const currentTokens = estimateTokens(messages);

  // Always: truncate individual oversized tool outputs first
  let modified = false;
  for (const msg of messages) {
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-result' && part.output?.type === 'text' && part.output.value.length > 8000) {
          const origLen = part.output.value.length;
          part.output.value = part.output.value.substring(0, 8000) + '\n...[truncated, original: ' + origLen + ' chars]';
          modified = true;
        }
      }
    }
  }

  const tokensAfterTruncation = estimateTokens(messages);

  // If under budget and not forced, return early
  if (!options?.forceTrim && tokensAfterTruncation <= budget) {
    return { messages, wasTrimmed: modified };
  }

  logger.info(`[ContextMgr] Over budget: ${tokensAfterTruncation} tokens > ${budget} budget (model: ${modelId}, window: ${contextWindow})`);

  // === Layer 2: Summarize old messages ===
  // Keep the last 40% of messages intact, summarize the first 60%
  const keepRatio = 0.4;
  const splitIdx = Math.max(2, Math.floor(messages.length * (1 - keepRatio)));
  const oldMsgs = messages.slice(0, splitIdx);
  const recentMsgs = messages.slice(splitIdx);

  // Protect skill_content messages
  const protectedMsgs = oldMsgs.filter((m: any) => {
    const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
    return c.includes('<skill_content');
  });

  // Extract key info from old messages for summarization
  const oldContent = oldMsgs.map((m: any) => {
    const role = m.role;
    let text = '';
    if (typeof m.content === 'string') {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      text = m.content
        .filter((p: any) => p.type === 'text' && p.text)
        .map((p: any) => p.text)
        .join(' ');
    }
    return text ? `[${role}] ${text.substring(0, 300)}` : '';
  }).filter(Boolean).join('\n');

  // Try AI summarization
  let summary = '';
  if (oldContent.length > 200) {
    try {
      const { routeModel } = await import('@/lib/model-router');
      const route = await routeModel('summarize context');
      if (route?.model) {
        const cfg = await getModelConfig(route.model);
        const keyData = await getApiKeyByProvider(cfg?.provider || '');
        if (keyData?.api_key_encrypted && cfg) {
          const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
          const baseUrl = keyData.base_url || PROVIDER_BASE_URLS[cfg.provider] || 'https://api.openai.com/v1';
          const apiKey = Buffer.from(keyData.api_key_encrypted, 'base64').toString('utf-8');
          const summaryModel = createOpenAICompatible({
            name: 'ctx-summary',
            baseURL: baseUrl,
            apiKey,
          }).languageModel(route.model);

          const result = await generateText({
            model: summaryModel,
            prompt: `Summarize this conversation in Chinese. Keep: 1)User's core goals 2)Key decisions 3)Completed steps 4)Pending items. Max 300 chars.\n\n${oldContent.substring(0, 6000)}`,
            maxOutputTokens: 500,
            temperature: 0.3,
          });
          summary = result.text;
          logger.info(`[ContextMgr] AI summary: ${summary.length} chars`);
        }
      }
    } catch (e: any) {
      logger.info(`[ContextMgr] AI summary failed: ${e.message}`);
    }
  }

  // Layer 3: Fallback extraction if AI summary failed
  if (!summary) {
    const userMsgs = oldMsgs
      .filter((m: any) => m.role === 'user')
      .map((m: any) => typeof m.content === 'string' ? m.content : '')
      .filter(Boolean)
      .slice(-5);
    const asstMsgs = oldMsgs
      .filter((m: any) => m.role === 'assistant')
      .map((m: any) => typeof m.content === 'string' ? m.content : '')
      .filter((s: string) => s.length > 0)
      .slice(-3);
    summary = 'User requests: ' + userMsgs.join('; ').substring(0, 500) +
              '\nCompleted: ' + asstMsgs.map((s: string) => s.substring(0, 150)).join('; ').substring(0, 300);
  }

  // Build summary message
  const summaryMsg = {
    role: 'user' as const,
    content: `[Conversation Summary - ${tokensAfterTruncation} tokens trimmed to ${budget} budget]\n${summary}\n\nContinue based on this summary and the recent messages below. Do not repeat completed work.`,
  };
  const summaryAck = {
    role: 'assistant' as const,
    content: 'Understood, continuing from summary.',
  };

  const result = [summaryMsg, summaryAck, ...protectedMsgs, ...recentMsgs];
  const newTokens = estimateTokens(result);
  logger.info(`[ContextMgr] Trim: ${tokensAfterTruncation} -> ${newTokens} tokens (saved ${Math.round((1 - newTokens / tokensAfterTruncation) * 100)}%)`);

  // Layer 4: If still over budget, hard trim (keep last 10 messages)
  if (newTokens > budget) {
    logger.info(`[ContextMgr] Still over budget after summary, applying hard trim`);
    const hardTrimmed = result.slice(-10);
    // Ensure we start with a user message
    while (hardTrimmed.length > 0 && hardTrimmed[0].role !== 'user') {
      hardTrimmed.shift();
    }
    const hardTokens = estimateTokens(hardTrimmed);
    logger.info(`[ContextMgr] Hard trim: ${newTokens} -> ${hardTokens} tokens`);
    if (hardTrimmed.length === 0) return { messages, wasTrimmed: false };
  return { messages: hardTrimmed, wasTrimmed: true };
  }

  if (result.length === 0) return { messages, wasTrimmed: false };
  return { messages: result, wasTrimmed: true };
}
