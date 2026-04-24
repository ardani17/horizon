// ============================================
// Horizon Trader Platform — Rate Limiter Middleware
// ============================================

import type { MiddlewareFn } from './types';

/**
 * Options for the rate limiter middleware.
 */
export interface RateLimiterOptions {
  /** Maximum number of messages allowed within the window. Default: 10 */
  maxRequests?: number;
  /** Time window in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
}

/** Tracks request timestamps per user */
interface UserBucket {
  timestamps: number[];
}

/**
 * Rate Limiter middleware: prevents spam from a single user.
 *
 * Uses an in-memory sliding window approach keyed by Telegram user ID.
 * When a user exceeds the limit, the pipeline halts and a warning reply
 * is sent.
 *
 * Validates: Requirements 15.7 (middleware pipeline extensibility)
 */
export function createRateLimiterMiddleware(options?: RateLimiterOptions): MiddlewareFn {
  const maxRequests = options?.maxRequests ?? 10;
  const windowMs = options?.windowMs ?? 60_000;

  const buckets = new Map<number, UserBucket>();

  return async (ctx, next) => {
    const userId = ctx.message.from?.id;

    if (!userId) {
      return;
    }

    const now = Date.now();

    let bucket = buckets.get(userId);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(userId, bucket);
    }

    // Remove timestamps outside the current window
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

    if (bucket.timestamps.length >= maxRequests) {
      await ctx.reply('Terlalu banyak pesan. Silakan tunggu sebentar sebelum mengirim lagi.');
      return;
    }

    bucket.timestamps.push(now);

    await next();
  };
}

/**
 * Creates a rate limiter with an externally provided bucket store.
 * Useful for testing — allows injecting a pre-populated or inspectable map.
 */
export function createRateLimiterMiddlewareWithStore(
  store: Map<number, UserBucket>,
  options?: RateLimiterOptions,
): MiddlewareFn {
  const maxRequests = options?.maxRequests ?? 10;
  const windowMs = options?.windowMs ?? 60_000;

  return async (ctx, next) => {
    const userId = ctx.message.from?.id;

    if (!userId) {
      return;
    }

    const now = Date.now();

    let bucket = store.get(userId);
    if (!bucket) {
      bucket = { timestamps: [] };
      store.set(userId, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

    if (bucket.timestamps.length >= maxRequests) {
      await ctx.reply('Terlalu banyak pesan. Silakan tunggu sebentar sebelum mengirim lagi.');
      return;
    }

    bucket.timestamps.push(now);

    await next();
  };
}
