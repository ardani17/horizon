// ============================================
// Horizon Trader Platform — Logging Middleware
// ============================================

import type { ActivityLogInput } from '../../../shared/services/activityLog';
import type { MiddlewareFn } from './types';

/**
 * Options for the logging middleware.
 */
export interface LoggingMiddlewareOptions {
  /**
   * Function to persist an activity log entry.
   * Injected for testability.
   */
  log: (entry: ActivityLogInput) => Promise<void>;
}

/**
 * Logging middleware: records every incoming message to the activity_logs table.
 *
 * Logs are written before passing control to the next middleware so that
 * even messages that are later rejected (e.g., by rate limiting) are recorded.
 *
 * Validates: Requirements 23.1, 23.2
 */
export function createLoggingMiddleware(options: LoggingMiddlewareOptions): MiddlewareFn {
  const { log } = options;

  return async (ctx, next) => {
    const message = ctx.message;
    const userId = ctx.user?.id ?? null;

    await log({
      actor_id: userId,
      actor_type: 'member',
      action: 'telegram_message_received',
      target_type: null,
      target_id: null,
      details: {
        message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        telegram_user_id: message.from?.id ?? null,
        has_text: !!message.text,
        has_photo: !!message.photo,
        has_video: !!message.video,
      },
    });

    await next();
  };
}
