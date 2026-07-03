// @ts-nocheck
/**
 * Rate Limiter - Per-user rate limiting for chat endpoint
 * Uses in-memory store with sliding window algorithm.
 * Configurable via DB settings table key='rate_limit_config'.
 */
import { getSetting } from '@/lib/db';
import { logger } from './logger';

interface RateLimitEntry {
  timestamps: number[];
  blocked_until?: number;
}

// In-memory store (per-process, resets on restart)
const store = new Map<string, RateLimitEntry>();

// Default config
const DEFAULT_CONFIG = {
  max_requests_per_minute: 30,
  max_requests_per_hour: 200,
  block_duration_ms: 60000, // 1 minute block when exceeded
  cleanup_interval_ms: 300000, // Clean up old entries every 5 min
};

let lastCleanup = Date.now();

async function getConfig() {
  try {
    // First try dedicated rate_limit_config
    const raw = await getSetting('rate_limit_config');
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    // Fallback to advanced_config
    const advRaw = await getSetting('advanced_config');
    if (advRaw) {
      const adv = JSON.parse(advRaw);
      return {
        ...DEFAULT_CONFIG,
        max_requests_per_minute: adv.rate_limit_per_minute || DEFAULT_CONFIG.max_requests_per_minute,
        max_requests_per_hour: adv.rate_limit_per_hour || DEFAULT_CONFIG.max_requests_per_hour,
        block_duration_ms: adv.rate_limit_block_ms || DEFAULT_CONFIG.block_duration_ms,
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    // Remove entries older than 1 hour
    entry.timestamps = entry.timestamps.filter(t => now - t < 3600000);
    if (entry.timestamps.length === 0 && (!entry.blocked_until || entry.blocked_until < now)) {
      store.delete(key);
    }
  }
}

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
  const config = await getConfig();
  const now = Date.now();
  
  // Periodic cleanup
  cleanup();
  
  let entry = store.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(userId, entry);
  }
  
  // Check if blocked
  if (entry.blocked_until && entry.blocked_until > now) {
    const retryAfter = Math.ceil((entry.blocked_until - now) / 1000);
    logger.warn(`[RateLimit] User ${userId} blocked, retry after ${retryAfter}s`);
    return { allowed: false, retryAfter };
  }
  
  // Clean old timestamps
  entry.timestamps = entry.timestamps.filter(t => now - t < 3600000);
  
  // Check per-minute limit
  const recentMinute = entry.timestamps.filter(t => now - t < 60000);
  if (recentMinute.length >= config.max_requests_per_minute) {
    entry.blocked_until = now + config.block_duration_ms;
    logger.warn(`[RateLimit] User ${userId} exceeded per-minute limit (${recentMinute.length}/${config.max_requests_per_minute})`);
    return { allowed: false, retryAfter: Math.ceil(config.block_duration_ms / 1000) };
  }
  
  // Check per-hour limit
  if (entry.timestamps.length >= config.max_requests_per_hour) {
    entry.blocked_until = now + config.block_duration_ms * 5; // 5 min block
    logger.warn(`[RateLimit] User ${userId} exceeded per-hour limit (${entry.timestamps.length}/${config.max_requests_per_hour})`);
    return { allowed: false, retryAfter: Math.ceil(config.block_duration_ms * 5 / 1000) };
  }
  
  // Allowed
  entry.timestamps.push(now);
  const remaining = config.max_requests_per_minute - recentMinute.length - 1;
  return { allowed: true, remaining: Math.max(0, remaining) };
}
