// ============================================
// Horizon Trader Platform — Credit API Middleware
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, type ValidatedApiKey } from './apiKeyAuth';
import { checkGeneralLimit, checkSpendLimit, type RateLimitResult } from './rateLimiter';
import { ActivityLogService } from '@shared/services/activityLog';

/**
 * Middleware wrapper that combines API key authentication, rate limiting,
 * CORS configuration, and activity logging for all Credit API endpoints.
 *
 * Flow:
 * 1. Authenticate API key (X-API-Key header)
 * 2. Check rate limits (general + spend-specific)
 * 3. Set CORS headers based on allowed_origins from API key record
 * 4. Execute the route handler
 * 5. Log the request to activity_logs with actor_type "external_api"
 *
 * **Validates: Requirements 18.7, 18.8, 23.8**
 */

const activityLogService = new ActivityLogService();

/** Options for the Credit API middleware */
export interface CreditApiMiddlewareOptions {
  /** Whether this endpoint is a spend endpoint (stricter rate limit) */
  isSpendEndpoint?: boolean;
}

/** Extended request context passed to the route handler */
export interface CreditApiContext {
  /** The validated API key record */
  apiKey: ValidatedApiKey;
  /** The original request */
  request: NextRequest;
}

/**
 * Extract the client IP address from the request.
 * Checks X-Forwarded-For (set by Nginx), then X-Real-IP, then falls back to 'unknown'.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs; the first is the client
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Extract the request origin for CORS validation.
 */
function getOrigin(request: NextRequest): string | null {
  return request.headers.get('origin');
}

/**
 * Build CORS headers based on the API key's allowed_origins.
 *
 * If allowed_origins is set, only matching origins get the Access-Control-Allow-Origin header.
 * If allowed_origins is null/empty, no CORS headers are set (same-origin only).
 */
function buildCorsHeaders(
  apiKey: ValidatedApiKey,
  request: NextRequest,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const origin = getOrigin(request);

  if (!apiKey.allowed_origins || apiKey.allowed_origins.trim() === '') {
    // No allowed origins configured — don't set CORS headers
    return headers;
  }

  const allowedList = apiKey.allowed_origins
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (allowedList.length === 0) {
    return headers;
  }

  if (origin && allowedList.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key';
    headers['Access-Control-Max-Age'] = '86400';
    headers['Vary'] = 'Origin';
  }

  return headers;
}

/**
 * Create a rate-limited error response (HTTP 429).
 */
function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        error_code: 'RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak request. Silakan coba lagi nanti.',
        details: null,
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(result.retryAfter ?? 60),
      },
    },
  );
}

/**
 * Wrap a Credit API route handler with authentication, rate limiting, CORS, and logging.
 *
 * Usage:
 * ```ts
 * export const GET = withCreditApiMiddleware(async (ctx) => {
 *   // ctx.apiKey is the validated API key
 *   // ctx.request is the NextRequest
 *   return NextResponse.json({ success: true, data: ... });
 * });
 * ```
 */
export function withCreditApiMiddleware(
  handler: (ctx: CreditApiContext) => Promise<NextResponse>,
  options: CreditApiMiddlewareOptions = {},
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const clientIp = getClientIp(request);
    const endpoint = new URL(request.url).pathname;

    // --- 1. Handle CORS preflight ---
    if (request.method === 'OPTIONS') {
      // For preflight, we still need to authenticate to get allowed_origins.
      // But preflight requests don't carry custom headers, so we return
      // a generic CORS response if an Origin header is present.
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // --- 2. Authenticate API key ---
    const apiKey = await authenticateApiKey(request.headers);
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'AUTH_REQUIRED',
            message: 'API key tidak valid atau tidak disertakan',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 },
      );
    }

    // --- 3. Build CORS headers ---
    const corsHeaders = buildCorsHeaders(apiKey, request);

    // --- 4. Check general rate limit ---
    const generalResult = checkGeneralLimit(apiKey.id);
    if (!generalResult.allowed) {
      // Log the rate-limited request
      await logRequest(apiKey, endpoint, 429, clientIp);
      return rateLimitResponse(generalResult, corsHeaders);
    }

    // --- 5. Check spend rate limit (if applicable) ---
    if (options.isSpendEndpoint) {
      const spendResult = checkSpendLimit(apiKey.id);
      if (!spendResult.allowed) {
        await logRequest(apiKey, endpoint, 429, clientIp);
        return rateLimitResponse(spendResult, corsHeaders);
      }
    }

    // --- 6. Execute the route handler ---
    let response: NextResponse;
    let status = 500;
    try {
      response = await handler({ apiKey, request });
      status = response.status;
    } catch {
      status = 500;
      response = NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'INTERNAL_ERROR',
            message: 'Terjadi kesalahan internal',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 },
      );
    }

    // --- 7. Apply CORS and rate limit headers to the response ---
    const finalHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      finalHeaders.set(key, value);
    }
    finalHeaders.set('X-RateLimit-Remaining', String(generalResult.remaining));
    finalHeaders.set('X-RateLimit-Reset', String(generalResult.resetAt));

    const finalResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });

    // --- 8. Log the request to activity_logs ---
    const duration = Date.now() - startTime;
    await logRequest(apiKey, endpoint, status, clientIp, duration).catch(() => {
      // Logging failures should not break the response
    });

    return finalResponse;
  };
}

/**
 * Log a Credit API request to the activity_logs table.
 */
async function logRequest(
  apiKey: ValidatedApiKey,
  endpoint: string,
  responseStatus: number,
  clientIp: string,
  durationMs?: number,
): Promise<void> {
  await activityLogService.log({
    actor_id: apiKey.created_by,
    actor_type: 'external_api',
    action: 'credit_api_request',
    target_type: 'credit',
    target_id: null,
    details: {
      api_key_id: apiKey.id,
      api_key_prefix: apiKey.key_prefix,
      app_name: apiKey.app_name,
      endpoint,
      response_status: responseStatus,
      duration_ms: durationMs ?? null,
    },
    ip_address: clientIp,
  });
}
