import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ---- Mock dependencies ----
vi.mock('bcrypt', () => ({
  default: { compare: vi.fn() },
}));

vi.mock('@shared/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@shared/services/activityLog', () => ({
  ActivityLogService: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../frontend/src/lib/apiKeyAuth', () => ({
  authenticateApiKey: vi.fn(),
}));

vi.mock('../../../frontend/src/lib/rateLimiter', () => ({
  checkGeneralLimit: vi.fn(),
  checkSpendLimit: vi.fn(),
}));

import { authenticateApiKey } from '../../../frontend/src/lib/apiKeyAuth';
import { checkGeneralLimit, checkSpendLimit } from '../../../frontend/src/lib/rateLimiter';
import { withCreditApiMiddleware } from '../../../frontend/src/lib/creditApiMiddleware';

const mockAuthenticateApiKey = vi.mocked(authenticateApiKey);
const mockCheckGeneralLimit = vi.mocked(checkGeneralLimit);
const mockCheckSpendLimit = vi.mocked(checkSpendLimit);

function fakeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-uuid-1',
    key_prefix: 'hzn_abcd',
    app_name: 'Test App',
    created_by: 'admin-uuid-1',
    allowed_origins: 'https://example.com,https://app.example.com',
    is_active: true,
    last_used_at: null,
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeRequest(url: string, options: RequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function allowedRateLimit() {
  return { allowed: true, remaining: 99, resetAt: Math.ceil(Date.now() / 1000) + 60 };
}

describe('withCreditApiMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckGeneralLimit.mockReturnValue(allowedRateLimit());
    mockCheckSpendLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Math.ceil(Date.now() / 1000) + 60 });
  });

  it('returns 401 when API key is missing or invalid', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(null);

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance');
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.error_code).toBe('AUTH_REQUIRED');
  });

  it('returns 429 when general rate limit is exceeded', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);
    mockCheckGeneralLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: 1700000060,
      retryAfter: 30,
    });

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance');
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('returns 429 when spend rate limit is exceeded', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);
    mockCheckSpendLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: 1700000060,
      retryAfter: 15,
    });

    const handler = withCreditApiMiddleware(
      async () => NextResponse.json({ success: true }),
      { isSpendEndpoint: true },
    );

    const req = makeRequest('/api/credit/spend', { method: 'POST' });
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBe('15');
  });

  it('does not check spend limit for non-spend endpoints', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance');
    await handler(req);

    expect(mockCheckSpendLimit).not.toHaveBeenCalled();
  });

  it('sets CORS headers when origin matches allowed_origins', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance', {
      headers: { Origin: 'https://example.com' },
    });
    const res = await handler(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('does not set CORS headers when origin does not match', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance', {
      headers: { Origin: 'https://evil.com' },
    });
    const res = await handler(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('does not set CORS headers when allowed_origins is null', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey({ allowed_origins: null }) as never);

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance', {
      headers: { Origin: 'https://example.com' },
    });
    const res = await handler(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('adds rate limit headers to successful responses', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);
    mockCheckGeneralLimit.mockReturnValueOnce({
      allowed: true,
      remaining: 95,
      resetAt: 1700000060,
    });

    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true, data: {} });
    });

    const req = makeRequest('/api/credit/balance');
    const res = await handler(req);

    expect(res.headers.get('X-RateLimit-Remaining')).toBe('95');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('1700000060');
  });

  it('passes the API key and request to the handler', async () => {
    const apiKey = fakeApiKey();
    mockAuthenticateApiKey.mockResolvedValueOnce(apiKey as never);

    let receivedCtx: { apiKey: unknown; request: unknown } | null = null;
    const handler = withCreditApiMiddleware(async (ctx) => {
      receivedCtx = ctx;
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance');
    await handler(req);

    expect(receivedCtx).not.toBeNull();
    expect(receivedCtx!.apiKey).toEqual(apiKey);
    expect(receivedCtx!.request).toBe(req);
  });

  it('handles OPTIONS preflight requests', async () => {
    const handler = withCreditApiMiddleware(async () => {
      return NextResponse.json({ success: true });
    });

    const req = makeRequest('/api/credit/balance', { method: 'OPTIONS' });
    const res = await handler(req);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-API-Key');
  });

  it('returns 500 and still logs when handler throws', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce(fakeApiKey() as never);

    const handler = withCreditApiMiddleware(async () => {
      throw new Error('Unexpected failure');
    });

    const req = makeRequest('/api/credit/balance');
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.error_code).toBe('INTERNAL_ERROR');
  });
});
