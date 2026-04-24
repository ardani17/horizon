// ============================================
// Horizon Trader Platform — Bot Error Handling
// ============================================

import { AppError, toAppError, InternalError } from '../../../shared/utils/errors';
import type { ActivityLogInput } from '../../../shared/services/activityLog';

/**
 * Patterns that indicate internal/technical information that must never
 * be exposed to end users in Telegram error messages.
 *
 * Validates: Requirements 24.5
 */
const INTERNAL_INFO_PATTERNS = [
  // Stack traces
  /at\s+\S+\s+\(/i,
  /\.\w+:\d+:\d+/,
  // SQL / database references
  /\bSELECT\b/i,
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bFROM\b\s+\w+/i,
  /\bJOIN\b/i,
  /\bWHERE\b/i,
  /\btable\b/i,
  /\bcolumn\b/i,
  /\brelation\b/i,
  /\bpostgres/i,
  /\bpg_/i,
  // File paths
  /\/\w+\/\w+\.\w+/,
  // Connection strings
  /\bconnection\b.*\brefused\b/i,
  /\bECONNREFUSED\b/i,
  /\bETIMEDOUT\b/i,
];

/**
 * Known error-code-to-user-message mappings.
 * Format: "Gagal [aksi]. [Penyebab]. [Saran tindakan]."
 *
 * Validates: Requirements 24.4
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Gagal memproses perintah. Autentikasi diperlukan. Pastikan Anda terdaftar sebagai anggota grup.',
  AUTH_INVALID: 'Gagal memproses perintah. Sesi tidak valid. Silakan coba lagi.',
  AUTH_FORBIDDEN: 'Gagal memproses perintah. Anda tidak memiliki izin untuk aksi ini. Hubungi admin jika ini keliru.',
  RESOURCE_NOT_FOUND: 'Gagal memproses perintah. Data yang diminta tidak ditemukan. Periksa kembali input Anda.',
  VALIDATION_ERROR: 'Gagal memproses perintah. Input tidak valid. Periksa format pesan Anda dan coba lagi.',
  CREDIT_INSUFFICIENT: 'Gagal memproses transaksi. Saldo credit tidak mencukupi. Periksa saldo Anda terlebih dahulu.',
  MEDIA_TYPE_INVALID: 'Gagal mengunggah media. Tipe file tidak didukung. Kirim hanya gambar atau video.',
  MEDIA_SIZE_EXCEEDED: 'Gagal mengunggah media. Ukuran file terlalu besar. Coba kirim ulang dengan file yang lebih kecil.',
  RATE_LIMIT_EXCEEDED: 'Gagal memproses perintah. Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.',
  INTERNAL_ERROR: 'Gagal memproses perintah. Terjadi kesalahan pada sistem. Silakan coba lagi nanti.',
};

const DEFAULT_USER_MESSAGE = 'Gagal memproses perintah. Terjadi kesalahan yang tidak terduga. Silakan coba lagi nanti.';

/**
 * Check whether a string contains internal/technical information
 * that should not be shown to users.
 */
export function containsInternalInfo(text: string): boolean {
  return INTERNAL_INFO_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Produce a user-friendly error message from any error.
 *
 * - For `AppError` instances, uses the error code to look up a predefined
 *   Bahasa Indonesia message in the format:
 *   "Gagal [aksi]. [Penyebab]. [Saran tindakan]."
 * - For unknown errors, returns a generic safe message.
 * - Never includes stack traces, table names, SQL, or file paths.
 *
 * Validates: Requirements 24.4, 24.5
 */
export function formatBotErrorMessage(error: unknown): string {
  const appError = toAppError(error);

  // Look up a predefined user-friendly message by error code
  const predefined = ERROR_CODE_MESSAGES[appError.errorCode];
  if (predefined) {
    return predefined;
  }

  // If the AppError message is safe (no internal info), use it
  if (appError.message && !containsInternalInfo(appError.message)) {
    return `Gagal memproses perintah. ${appError.message}. Silakan coba lagi.`;
  }

  return DEFAULT_USER_MESSAGE;
}

/**
 * Context information for error logging.
 */
export interface ErrorContext {
  /** The action being performed when the error occurred */
  action: string;
  /** The user ID of the actor (nullable for system errors) */
  userId?: string | null;
  /** The Telegram user ID */
  telegramUserId?: number | null;
  /** The chat ID where the error occurred */
  chatId?: number | null;
  /** The message ID that triggered the error */
  messageId?: number | null;
  /** Additional context data */
  extra?: Record<string, unknown>;
}

/**
 * Dependency for logging errors — accepts the same interface as ActivityLogService.log().
 */
export interface ErrorLogger {
  log(entry: ActivityLogInput): Promise<void>;
}

/**
 * Log full error details to activity_logs for debugging.
 *
 * Records the complete error information (message, stack trace, error code,
 * details, and context) in the activity_logs table with action "error".
 * This is the server-side counterpart to the sanitised user-facing message.
 *
 * Validates: Requirements 24.6, 24.8
 */
export async function logBotError(
  error: unknown,
  context: ErrorContext,
  logger: ErrorLogger,
): Promise<void> {
  const appError = toAppError(error);

  const details: Record<string, unknown> = {
    error_code: appError.errorCode,
    error_message: appError.message,
    error_name: appError.name,
    stack_trace: appError.stack ?? null,
    error_details: appError.details,
    context_action: context.action,
    telegram_user_id: context.telegramUserId ?? null,
    chat_id: context.chatId ?? null,
    message_id: context.messageId ?? null,
    ...context.extra,
  };

  try {
    await logger.log({
      actor_id: context.userId ?? null,
      actor_type: context.userId ? 'member' : 'system',
      action: 'error',
      target_type: null,
      target_id: null,
      details,
      ip_address: null,
    });
  } catch {
    // If logging itself fails, we can't do much — avoid infinite loops.
    // In production this would go to stderr/stdout.
    console.error('[errorHandler] Failed to log error to activity_logs:', appError.message);
  }
}

/**
 * Options for the retry-with-backoff utility.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Optional predicate to decide if an error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Retry a function with exponential backoff.
 *
 * Designed for retrying Telegram API calls that may fail due to transient
 * network issues or rate limiting. Uses exponential backoff with the formula:
 * `delay = baseDelayMs * 2^attempt` (0-indexed).
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the function on success
 * @throws The last error if all retries are exhausted
 *
 * Validates: Requirements 24.8
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, isRetryable } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If we've exhausted all retries, throw
      if (attempt >= maxRetries) {
        break;
      }

      // If the error is not retryable, throw immediately
      if (isRetryable && !isRetryable(error)) {
        break;
      }

      // Wait with exponential backoff before retrying
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given number of milliseconds.
 * Extracted as a named export for testability (can be mocked in tests).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a bot handler function with error handling.
 *
 * Catches any error thrown by the handler, formats a user-friendly message,
 * sends it to the user via `ctx.reply`, and logs the full error details
 * to activity_logs.
 *
 * Validates: Requirements 24.4, 24.5, 24.6
 */
export function withBotErrorHandling(
  handler: (ctx: import('../middleware/types').BotContext) => Promise<void>,
  logger: ErrorLogger,
  actionName: string,
): (ctx: import('../middleware/types').BotContext) => Promise<void> {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      // Format a safe user-facing message
      const userMessage = formatBotErrorMessage(error);
      await ctx.reply(userMessage);

      // Log full error details to activity_logs
      await logBotError(error, {
        action: actionName,
        userId: ctx.user?.id ?? null,
        telegramUserId: ctx.message?.from?.id ?? null,
        chatId: ctx.message?.chat?.id ?? null,
        messageId: ctx.message?.message_id ?? null,
      }, logger);
    }
  };
}
