// ============================================
// Horizon Trader Platform — Middleware Pipeline Tests
// ============================================

import { describe, it, expect, vi } from 'vitest';
import { MiddlewarePipeline } from '../../../bot/src/middleware/pipeline';
import { createAuthMiddleware } from '../../../bot/src/middleware/auth';
import { createAutoRegisterMiddleware } from '../../../bot/src/middleware/autoRegister';
import { createLoggingMiddleware } from '../../../bot/src/middleware/logging';
import { createRateLimiterMiddleware } from '../../../bot/src/middleware/rateLimiter';
import type { BotContext, MiddlewareFn, TelegramMessage } from '../../../bot/src/middleware/types';
import type { User } from '../../../shared/types/index';
import { AppError } from '../../../shared/utils/errors';

// ---- Test Helpers ----

function createTestMessage(overrides?: Partial<TelegramMessage>): TelegramMessage {
  return {
    message_id: 1,
    from: {
      id: 12345,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    chat: {
      id: -100123,
      type: 'supergroup',
    },
    date: Math.floor(Date.now() / 1000),
    text: 'Hello world',
    ...overrides,
  };
}

function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'user-uuid-1',
    telegram_id: 12345,
    username: 'testuser',
    password_hash: null,
    role: 'member',
    credit_balance: 0,
    created_at: new Date(),
    ...overrides,
  };
}

function createTestContext(overrides?: Partial<BotContext>): BotContext {
  return {
    message: createTestMessage(),
    user: createTestUser(),
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- MiddlewarePipeline Tests ----

describe('MiddlewarePipeline', () => {
  it('should execute middlewares in registration order', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.use(async (_ctx, next) => {
      order.push(1);
      await next();
    });
    pipeline.use(async (_ctx, next) => {
      order.push(2);
      await next();
    });
    pipeline.use(async (_ctx, next) => {
      order.push(3);
      await next();
    });

    await pipeline.execute(createTestContext());

    expect(order).toEqual([1, 2, 3]);
  });

  it('should stop pipeline when middleware does not call next', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.use(async (_ctx, next) => {
      order.push(1);
      await next();
    });
    pipeline.use(async () => {
      order.push(2);
      // Does NOT call next — pipeline stops here
    });
    pipeline.use(async (_ctx, next) => {
      order.push(3);
      await next();
    });

    await pipeline.execute(createTestContext());

    expect(order).toEqual([1, 2]);
  });

  it('should handle empty pipeline gracefully', async () => {
    const pipeline = new MiddlewarePipeline();
    await expect(pipeline.execute(createTestContext())).resolves.toBeUndefined();
  });

  it('should pass the same context to all middlewares', async () => {
    const pipeline = new MiddlewarePipeline();
    const contexts: BotContext[] = [];

    pipeline.use(async (ctx, next) => {
      contexts.push(ctx);
      await next();
    });
    pipeline.use(async (ctx, next) => {
      contexts.push(ctx);
      await next();
    });

    const ctx = createTestContext();
    await pipeline.execute(ctx);

    expect(contexts[0]).toBe(ctx);
    expect(contexts[1]).toBe(ctx);
  });

  it('should allow middleware to modify context for downstream middlewares', async () => {
    const pipeline = new MiddlewarePipeline();
    const newUser = createTestUser({ id: 'modified-user' });

    pipeline.use(async (ctx, next) => {
      ctx.user = newUser;
      await next();
    });

    let capturedUser: User | undefined;
    pipeline.use(async (ctx, next) => {
      capturedUser = ctx.user;
      await next();
    });

    await pipeline.execute(createTestContext());

    expect(capturedUser?.id).toBe('modified-user');
  });

  it('should propagate errors thrown by middleware', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(async () => {
      throw new Error('middleware error');
    });

    await expect(pipeline.execute(createTestContext())).rejects.toThrow('middleware error');
  });
});

// ---- Auth Middleware Tests ----

describe('Auth Middleware', () => {
  it('should call next when user is a group member', async () => {
    const checkMembership = vi.fn().mockResolvedValue(true);
    const middleware = createAuthMiddleware({ groupChatId: -100, checkMembership });

    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext();

    await middleware(ctx, nextFn);

    expect(checkMembership).toHaveBeenCalledWith(-100, 12345);
    expect(nextFn).toHaveBeenCalled();
  });

  it('should halt pipeline when user is not a group member', async () => {
    const checkMembership = vi.fn().mockResolvedValue(false);
    const middleware = createAuthMiddleware({ groupChatId: -100, checkMembership });

    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext();

    await middleware(ctx, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should halt pipeline when message has no sender', async () => {
    const checkMembership = vi.fn().mockResolvedValue(true);
    const middleware = createAuthMiddleware({ groupChatId: -100, checkMembership });

    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext({
      message: createTestMessage({ from: undefined }),
    });

    await middleware(ctx, nextFn);

    expect(checkMembership).not.toHaveBeenCalled();
    expect(nextFn).not.toHaveBeenCalled();
  });
});

// ---- Auto-Register Middleware Tests ----

describe('Auto-Register Middleware', () => {
  it('should use existing user when found in database', async () => {
    const existingUser = createTestUser({ id: 'existing-user' });
    const findUserByTelegramId = vi.fn().mockResolvedValue(existingUser);
    const createUser = vi.fn();

    const middleware = createAutoRegisterMiddleware({ findUserByTelegramId, createUser });
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext();

    await middleware(ctx, nextFn);

    expect(findUserByTelegramId).toHaveBeenCalledWith(12345);
    expect(createUser).not.toHaveBeenCalled();
    expect(ctx.user).toBe(existingUser);
    expect(nextFn).toHaveBeenCalled();
  });

  it('should create new user when not found in database', async () => {
    const newUser = createTestUser({ id: 'new-user' });
    const findUserByTelegramId = vi.fn().mockResolvedValue(null);
    const createUser = vi.fn().mockResolvedValue(newUser);

    const middleware = createAutoRegisterMiddleware({ findUserByTelegramId, createUser });
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext();

    await middleware(ctx, nextFn);

    expect(createUser).toHaveBeenCalledWith({
      telegram_id: 12345,
      username: 'testuser',
      role: 'member',
    });
    expect(ctx.user).toBe(newUser);
    expect(nextFn).toHaveBeenCalled();
  });

  it('should handle user without username', async () => {
    const newUser = createTestUser({ id: 'new-user', username: null });
    const findUserByTelegramId = vi.fn().mockResolvedValue(null);
    const createUser = vi.fn().mockResolvedValue(newUser);

    const middleware = createAutoRegisterMiddleware({ findUserByTelegramId, createUser });
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext({
      message: createTestMessage({
        from: { id: 12345, is_bot: false, first_name: 'Test', username: undefined },
      }),
    });

    await middleware(ctx, nextFn);

    expect(createUser).toHaveBeenCalledWith({
      telegram_id: 12345,
      username: null,
      role: 'member',
    });
    expect(nextFn).toHaveBeenCalled();
  });

  it('should halt pipeline when message has no sender', async () => {
    const findUserByTelegramId = vi.fn();
    const createUser = vi.fn();

    const middleware = createAutoRegisterMiddleware({ findUserByTelegramId, createUser });
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext({
      message: createTestMessage({ from: undefined }),
    });

    await middleware(ctx, nextFn);

    expect(findUserByTelegramId).not.toHaveBeenCalled();
    expect(nextFn).not.toHaveBeenCalled();
  });
});

// ---- Logging Middleware Tests ----

describe('Logging Middleware', () => {
  it('should log incoming message details', async () => {
    const logFn = vi.fn().mockResolvedValue(undefined);
    const middleware = createLoggingMiddleware({ log: logFn });

    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext();

    await middleware(ctx, nextFn);

    expect(logFn).toHaveBeenCalledWith({
      actor_id: 'user-uuid-1',
      actor_type: 'member',
      action: 'telegram_message_received',
      target_type: null,
      target_id: null,
      details: {
        message_id: 1,
        chat_id: -100123,
        chat_type: 'supergroup',
        telegram_user_id: 12345,
        has_text: true,
        has_photo: false,
        has_video: false,
      },
    });
    expect(nextFn).toHaveBeenCalled();
  });

  it('should log before calling next', async () => {
    const callOrder: string[] = [];
    const logFn = vi.fn().mockImplementation(async () => {
      callOrder.push('log');
    });
    const nextFn = vi.fn().mockImplementation(async () => {
      callOrder.push('next');
    });

    const middleware = createLoggingMiddleware({ log: logFn });
    await middleware(createTestContext(), nextFn);

    expect(callOrder).toEqual(['log', 'next']);
  });
});

// ---- Rate Limiter Middleware Tests ----

describe('Rate Limiter Middleware', () => {
  it('should allow requests under the limit', async () => {
    const middleware = createRateLimiterMiddleware({ maxRequests: 3, windowMs: 60_000 });
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext();

    await middleware(ctx, nextFn);

    expect(nextFn).toHaveBeenCalled();
  });

  it('should block requests exceeding the limit', async () => {
    const middleware = createRateLimiterMiddleware({ maxRequests: 2, windowMs: 60_000 });
    const ctx = createTestContext();

    // First two requests should pass
    const next1 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx, next1);
    expect(next1).toHaveBeenCalled();

    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx, next2);
    expect(next2).toHaveBeenCalled();

    // Third request should be blocked
    const next3 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'Terlalu banyak pesan. Silakan tunggu sebentar sebelum mengirim lagi.',
    );
  });

  it('should track different users independently', async () => {
    const middleware = createRateLimiterMiddleware({ maxRequests: 1, windowMs: 60_000 });

    const ctx1 = createTestContext({
      message: createTestMessage({ from: { id: 111, is_bot: false, first_name: 'A' } }),
    });
    const ctx2 = createTestContext({
      message: createTestMessage({ from: { id: 222, is_bot: false, first_name: 'B' } }),
    });

    const next1 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx1, next1);
    expect(next1).toHaveBeenCalled();

    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2, next2);
    expect(next2).toHaveBeenCalled();
  });

  it('should halt pipeline when message has no sender', async () => {
    const middleware = createRateLimiterMiddleware({ maxRequests: 10, windowMs: 60_000 });
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext({
      message: createTestMessage({ from: undefined }),
    });

    await middleware(ctx, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
  });
});

// ---- Integration: Full Pipeline ----

describe('Full Middleware Pipeline Integration', () => {
  it('should execute auth → autoRegister → logging → rateLimiter → handler in order', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: string[] = [];
    const testUser = createTestUser();

    pipeline.use(async (ctx, next) => {
      order.push('auth');
      await next();
    });

    pipeline.use(async (ctx, next) => {
      order.push('autoRegister');
      ctx.user = testUser;
      await next();
    });

    pipeline.use(async (ctx, next) => {
      order.push('logging');
      await next();
    });

    pipeline.use(async (ctx, next) => {
      order.push('rateLimiter');
      await next();
    });

    pipeline.use(async (ctx, next) => {
      order.push('handler');
      await next();
    });

    await pipeline.execute(createTestContext());

    expect(order).toEqual(['auth', 'autoRegister', 'logging', 'rateLimiter', 'handler']);
  });

  it('should stop at auth when user is not a member', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: string[] = [];

    const authMiddleware = createAuthMiddleware({
      groupChatId: -100,
      checkMembership: vi.fn().mockResolvedValue(false),
    });

    pipeline.use(async (ctx, next) => {
      order.push('auth');
      await authMiddleware(ctx, next);
    });

    pipeline.use(async (_ctx, next) => {
      order.push('autoRegister');
      await next();
    });

    await pipeline.execute(createTestContext());

    expect(order).toEqual(['auth']);
  });
});
