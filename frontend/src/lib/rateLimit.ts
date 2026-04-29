import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** In-memory rate limit store (per-process). Entries auto-expire. */
const store = new Map<string, RateLimitEntry>();

/** Clean up expired entries periodically */
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000; // 1 minute

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for (behind reverse proxy) then x-real-ip.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key prefix to separate different endpoints */
  prefix: string;
}

/**
 * Check rate limit for a request. Returns null if allowed,
 * or a 429 response if rate limit exceeded.
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
): NextResponse | null {
  cleanup();

  const ip = getClientIp(request);
  const key = `${options.prefix}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > options.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'RATE_LIMITED',
          message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
          details: { retry_after_seconds: retryAfter },
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  return null;
}
