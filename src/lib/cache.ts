/**
 * In-memory LRU-like cache for hot data
 * TTL-based expiration, max size limit
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();
const MAX_SIZE = 500;
const DEFAULT_TTL = 60000; // 60s

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL): void {
  // Evict oldest if at capacity
  if (store.size >= MAX_SIZE) {
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(): void {
  store.clear();
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 30000);
