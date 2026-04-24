// ============================================
// Horizon Trader Platform — Credit API Rate Limiter
// ============================================

/**
 * In-memory sliding window rate limiter for Credit API.
 *
 * Tracks request timestamps per API key and enforces two limits:
 * - 100 requests/min per API key (general)
 * - 10 spend requests/min per API key (spend-specific)
 *
 * Uses a sliding window approach: only timestamps within the last 60 seconds
 * are considered. Expired entries are pruned on each check.
 *
 * **Validates: Requirements 18.7**
 */

/** Result of a rate limit check */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  resetAt: number;
  /** Seconds until the caller can retry (only set when blocked) */
  retryAfter?: number;
}

/** Configuration for a rate limit bucket */
interface RateLimitBucket {
  /** Request timestamps (ms) within the current window */
  timestamps: number[];
}

const WINDOW_MS = 60_000; // 60 seconds
const GENERAL_LIMIT = 100; // 100 requests per minute per API key
const SPEND_LIMIT = 10; // 10 spend requests per minute per API key

/** In-memory store: apiKeyId -> timestamps */
const generalBuckets = new Map<string, RateLimitBucket>();
/** In-memory store: apiKeyId -> timestamps (spend-only) */
const spendBuckets = new Map<string, RateLimitBucket>();

/**
 * Prune timestamps older than the sliding window from a bucket.
 */
function pruneExpired(bucket: RateLimitBucket, now: number): void {
  const cutoff = now - WINDOW_MS;
  // Find the first index that is within the window
  let i = 0;
  while (i < bucket.timestamps.length && bucket.timestamps[i] < cutoff) {
    i++;
  }
  if (i > 0) {
    bucket.timestamps.splice(0, i);
  }
}

/**
 * Get or create a bucket for the given key in the given store.
 */
function getBucket(store: Map<string, RateLimitBucket>, key: string): RateLimitBucket {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }
  return bucket;
}

/**
 * Check and record a request against the general rate limit.
 *
 * @param apiKeyId - The API key ID to rate limit
 * @returns Rate limit result with remaining count and reset time
 */
export function checkGeneralLimit(apiKeyId: string): RateLimitResult {
  const now = Date.now();
  const bucket = getBucket(generalBuckets, apiKeyId);
  pruneExpired(bucket, now);

  const resetAt = Math.ceil((now + WINDOW_MS) / 1000);
  const remaining = GENERAL_LIMIT - bucket.timestamps.length;

  if (remaining <= 0) {
    // Find when the oldest request in the window expires
    const oldestInWindow = bucket.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  // Record this request
  bucket.timestamps.push(now);

  return {
    allowed: true,
    remaining: remaining - 1,
    resetAt,
  };
}

/**
 * Check and record a request against the spend rate limit.
 *
 * @param apiKeyId - The API key ID to rate limit
 * @returns Rate limit result with remaining count and reset time
 */
export function checkSpendLimit(apiKeyId: string): RateLimitResult {
  const now = Date.now();
  const bucket = getBucket(spendBuckets, apiKeyId);
  pruneExpired(bucket, now);

  const resetAt = Math.ceil((now + WINDOW_MS) / 1000);
  const remaining = SPEND_LIMIT - bucket.timestamps.length;

  if (remaining <= 0) {
    const oldestInWindow = bucket.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  // Record this request
  bucket.timestamps.push(now);

  return {
    allowed: true,
    remaining: remaining - 1,
    resetAt,
  };
}

/**
 * Clear all rate limit buckets. Useful for testing.
 */
export function clearAllBuckets(): void {
  generalBuckets.clear();
  spendBuckets.clear();
}
