// ============================================
// Horizon Trader Platform — Bot Error Handler Tests
// ============================================

import { describe, it, expect, vi } from 'vitest';
import {
  formatBotErrorMessage,
  logBotError,
  retryWithBackoff,
  withBotErrorHandling,
  containsInternalInfo,
  sleep,
} from '../../../bot/src/utils/errorHandler';
import type { ErrorLogger, ErrorContext } from '../../../bot/src/utils/errorHandler';
import {
  AppError,
  ValidationError,
  AuthForbiddenError,
  CreditInsufficientError,
  MediaSizeExceededError,
  MediaTypeInvalidError,
  RateLimitExceededError,
  InternalError,
  AuthRequiredError,
  AuthInvalidError,
  ResourceNotFoundError,
} from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/index';
import type { BotContext } from '../../../bot/src/middleware/types';
import type { User } from '../../../shared/types/index';

// ---- Test Helpers ----

function createMockLogger(): ErrorLogger {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function createTestContext(overrides?: Partial<BotContext>): BotContext {
  return {
    message: {
      message_id: 42,
      from: { id: 12345, is_bot: false, first_name: 'Test', username: 'testuser' },
      chat: { id: -100123, type: 'supergroup' },
      date: Math.floor(Date.now() / 1000),
      text: 'Hello',
    },
    user: {
      id: 'user-uuid-1',
      telegram_id: 12345,
      username: 'testuser',
      password_hash: null,
      role: 'member',
      credit_balance: 0,
      created_at: new Date(),
    } as User,
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    replyWithMessageId: vi.fn().mockResolvedValue(1),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

// ---- containsInternalInfo ----

describe('containsInternalInfo', () => {
  it('detects stack traces', () => {
    expect(containsInternalInfo('at Object.<anonymous> (/app/src/index.ts:10:5)')).toBe(true);
  });

  it('detects SQL keywords', () => {
    expect(containsInternalInfo('SELECT * FROM users WHERE id = 1')).toBe(true);
    expect(containsInternalInfo('INSERT INTO articles VALUES ...')).toBe(true);
    expect(containsInternalInfo('UPDATE users SET credit_balance = 0')).toBe(true);
    expect(containsInternalInfo('DELETE FROM media')).toBe(true);
  });

  it('detects database table references', () => {
    expect(containsInternalInfo('relation "users" does not exist')).toBe(true);
    expect(containsInternalInfo('column "slug" is not unique')).toBe(true);
    expect(containsInternalInfo('pg_catalog error')).toBe(true);
  });

  it('detects file paths', () => {
    expect(containsInternalInfo('/app/src/handlers/hashtagHandler.ts')).toBe(true);
  });

  it('detects connection errors', () => {
    expect(containsInternalInfo('connection refused to postgres')).toBe(true);
    expect(containsInternalInfo('ECONNREFUSED 127.0.0.1:5432')).toBe(true);
  });

  it('returns false for safe user messages', () => {
    expect(containsInternalInfo('Gagal mempublikasikan artikel.')).toBe(false);
    expect(containsInternalInfo('Saldo credit tidak mencukupi')).toBe(false);
    expect(containsInternalInfo('Silakan coba lagi nanti.')).toBe(false);
  });
});

// ---- formatBotErrorMessage ----

describe('formatBotErrorMessage', () => {
  it('returns predefined message for known AppError codes', () => {
    const cases: Array<{ error: AppError; expectedSubstring: string }> = [
      { error: new ValidationError(), expectedSubstring: 'Input tidak valid' },
      { error: new AuthForbiddenError(), expectedSubstring: 'tidak memiliki izin' },
      { error: new CreditInsufficientError(), expectedSubstring: 'Saldo credit tidak mencukupi' },
      { error: new MediaSizeExceededError(), expectedSubstring: 'Ukuran file terlalu besar' },
      { error: new MediaTypeInvalidError(), expectedSubstring: 'Tipe file tidak didukung' },
      { error: new RateLimitExceededError(), expectedSubstring: 'Terlalu banyak permintaan' },
      { error: new InternalError(), expectedSubstring: 'Terjadi kesalahan pada sistem' },
      { error: new AuthRequiredError(), expectedSubstring: 'Autentikasi diperlukan' },
      { error: new AuthInvalidError(), expectedSubstring: 'Sesi tidak valid' },
      { error: new ResourceNotFoundError(), expectedSubstring: 'tidak ditemukan' },
    ];

    for (const { error, expectedSubstring } of cases) {
      const message = formatBotErrorMessage(error);
      expect(message).toContain(expectedSubstring);
      expect(message).toMatch(/^Gagal /);
    }
  });

  it('returns a safe generic message for unknown errors', () => {
    const message = formatBotErrorMessage(new Error('SELECT * FROM users'));
    expect(message).not.toContain('SELECT');
    expect(message).not.toContain('users');
    expect(message).toMatch(/^Gagal /);
  });

  it('returns a safe message for string errors', () => {
    const message = formatBotErrorMessage('something broke');
    expect(message).toMatch(/^Gagal /);
  });

  it('returns a safe message for null/undefined errors', () => {
    expect(formatBotErrorMessage(null)).toMatch(/^Gagal /);
    expect(formatBotErrorMessage(undefined)).toMatch(/^Gagal /);
  });

  it('never includes stack traces in the output', () => {
    const error = new Error('test');
    error.stack = 'Error: test\n    at Object.<anonymous> (/app/src/index.ts:10:5)';
    const message = formatBotErrorMessage(error);
    expect(message).not.toContain('Object.<anonymous>');
    expect(message).not.toContain('/app/src');
    expect(message).not.toContain('index.ts');
  });

  it('never includes SQL in the output', () => {
    const error = new Error('INSERT INTO articles (id) VALUES ($1) failed');
    const message = formatBotErrorMessage(error);
    expect(message).not.toContain('INSERT');
    expect(message).not.toContain('articles');
  });

  it('never includes table names in the output', () => {
    const error = new Error('relation "credit_transactions" does not exist');
    const message = formatBotErrorMessage(error);
    expect(message).not.toContain('credit_transactions');
    expect(message).not.toContain('relation');
  });

  it('follows the format: Gagal [aksi]. [Penyebab]. [Saran tindakan].', () => {
    const message = formatBotErrorMessage(new ValidationError());
    // Should start with "Gagal" and contain multiple sentences
    expect(message).toMatch(/^Gagal .+\..+\./);
  });
});

// ---- logBotError ----

describe('logBotError', () => {
  it('logs full error details to activity_logs', async () => {
    const logger = createMockLogger();
    const error = new ValidationError('Email tidak valid', { field: 'email' });
    const context: ErrorContext = {
      action: 'publish_article',
      userId: 'user-uuid-1',
      telegramUserId: 12345,
      chatId: -100123,
      messageId: 42,
    };

    await logBotError(error, context, logger);

    expect(logger.log).toHaveBeenCalledOnce();
    const logEntry = (logger.log as ReturnType<typeof vi.fn>).mock.calls[0][0];

    expect(logEntry.actor_id).toBe('user-uuid-1');
    expect(logEntry.actor_type).toBe('member');
    expect(logEntry.action).toBe('error');
    expect(logEntry.details.error_code).toBe('VALIDATION_ERROR');
    expect(logEntry.details.error_message).toBe('Email tidak valid');
    expect(logEntry.details.error_details).toEqual({ field: 'email' });
    expect(logEntry.details.context_action).toBe('publish_article');
    expect(logEntry.details.telegram_user_id).toBe(12345);
    expect(logEntry.details.chat_id).toBe(-100123);
    expect(logEntry.details.message_id).toBe(42);
    expect(logEntry.details.stack_trace).toBeTruthy();
  });

  it('uses actor_type "system" when no userId is provided', async () => {
    const logger = createMockLogger();
    await logBotError(new Error('system failure'), { action: 'startup' }, logger);

    const logEntry = (logger.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logEntry.actor_type).toBe('system');
    expect(logEntry.actor_id).toBeNull();
  });

  it('includes extra context data in details', async () => {
    const logger = createMockLogger();
    await logBotError(
      new Error('fail'),
      { action: 'upload', extra: { file_size: 999999 } },
      logger,
    );

    const logEntry = (logger.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logEntry.details.file_size).toBe(999999);
  });

  it('does not throw when logger itself fails', async () => {
    const logger: ErrorLogger = {
      log: vi.fn().mockRejectedValue(new Error('DB down')),
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logBotError(new Error('original'), { action: 'test' }, logger),
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('wraps non-AppError values before logging', async () => {
    const logger = createMockLogger();
    await logBotError('string error', { action: 'test' }, logger);

    const logEntry = (logger.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logEntry.details.error_code).toBe('INTERNAL_ERROR');
  });
});

// ---- retryWithBackoff ----

describe('retryWithBackoff', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('always fails')));

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('defaults to 3 max retries', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('fail')));

    await expect(
      retryWithBackoff(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('uses exponential backoff delays', async () => {
    const callTimestamps: number[] = [];

    const fn = vi.fn().mockImplementation(() => {
      callTimestamps.push(Date.now());
      if (callTimestamps.length < 3) {
        return Promise.reject(new Error('fail'));
      }
      return Promise.resolve('ok');
    });

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 50 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);

    // Verify delays are increasing (exponential backoff)
    // First retry delay: ~50ms (50 * 2^0), second: ~100ms (50 * 2^1)
    const delay1 = callTimestamps[1] - callTimestamps[0];
    const delay2 = callTimestamps[2] - callTimestamps[1];

    expect(delay1).toBeGreaterThanOrEqual(40); // ~50ms with tolerance
    expect(delay2).toBeGreaterThanOrEqual(80); // ~100ms with tolerance
    expect(delay2).toBeGreaterThan(delay1);    // second delay > first delay
  });

  it('stops retrying when isRetryable returns false', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('not retryable')));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        isRetryable: () => false,
      }),
    ).rejects.toThrow('not retryable');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries when isRetryable returns true', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('retryable'))
      .mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      isRetryable: () => true,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ---- withBotErrorHandling ----

describe('withBotErrorHandling', () => {
  it('calls the handler normally when no error occurs', async () => {
    const logger = createMockLogger();
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = withBotErrorHandling(handler, logger, 'test_action');
    const ctx = createTestContext();

    await wrapped(ctx);

    expect(handler).toHaveBeenCalledWith(ctx);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('catches errors and sends a user-friendly message', async () => {
    const logger = createMockLogger();
    const handler = vi.fn().mockRejectedValue(new ValidationError('bad input'));
    const wrapped = withBotErrorHandling(handler, logger, 'test_action');
    const ctx = createTestContext();

    await wrapped(ctx);

    expect(ctx.reply).toHaveBeenCalledOnce();
    const replyMessage = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(replyMessage).toMatch(/^Gagal /);
    expect(replyMessage).not.toContain('bad input');
  });

  it('logs the full error details to activity_logs', async () => {
    const logger = createMockLogger();
    const handler = vi.fn().mockRejectedValue(new InternalError('DB connection lost'));
    const wrapped = withBotErrorHandling(handler, logger, 'publish_article');
    const ctx = createTestContext();

    await wrapped(ctx);

    expect(logger.log).toHaveBeenCalledOnce();
    const logEntry = (logger.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logEntry.action).toBe('error');
    expect(logEntry.details.error_message).toBe('DB connection lost');
    expect(logEntry.details.context_action).toBe('publish_article');
    expect(logEntry.details.telegram_user_id).toBe(12345);
    expect(logEntry.details.chat_id).toBe(-100123);
    expect(logEntry.details.message_id).toBe(42);
  });

  it('does not re-throw the error', async () => {
    const logger = createMockLogger();
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withBotErrorHandling(handler, logger, 'test');
    const ctx = createTestContext();

    await expect(wrapped(ctx)).resolves.toBeUndefined();
  });

  it('never leaks internal info in the reply message', async () => {
    const logger = createMockLogger();
    const handler = vi.fn().mockRejectedValue(
      new Error('SELECT * FROM users WHERE telegram_id = 12345'),
    );
    const wrapped = withBotErrorHandling(handler, logger, 'test');
    const ctx = createTestContext();

    await wrapped(ctx);

    const replyMessage = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(replyMessage).not.toContain('SELECT');
    expect(replyMessage).not.toContain('users');
    expect(replyMessage).not.toContain('telegram_id');
  });
});
