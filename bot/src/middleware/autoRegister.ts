// ============================================
// Horizon Trader Platform — Auto-Register Middleware
// ============================================

import type { User } from '../../../shared/types/index';
import type { DbClient } from '../../../shared/db/query';
import type { MiddlewareFn } from './types';

/**
 * Options for the auto-register middleware.
 */
export interface AutoRegisterMiddlewareOptions {
  /**
   * Find a user by their Telegram ID.
   * Returns the user record or null if not found.
   */
  findUserByTelegramId: (telegramId: number, client?: DbClient) => Promise<User | null>;
  /**
   * Create a new user record from Telegram data.
   * Returns the newly created user.
   */
  createUser: (data: { telegram_id: number; username: string | null; role: 'member' }, client?: DbClient) => Promise<User>;
}

/**
 * Auto-Register middleware: upserts the user record.
 *
 * - If the user already exists in the database, uses the existing record.
 * - If the user is new, creates a record with telegram_id, username, and role "member".
 *
 * After this middleware, `ctx.user` is guaranteed to be populated.
 *
 * Validates: Requirements 11.3, 11.4, 11.5
 */
export function createAutoRegisterMiddleware(options: AutoRegisterMiddlewareOptions): MiddlewareFn {
  const { findUserByTelegramId, createUser } = options;

  return async (ctx, next) => {
    const telegramId = ctx.message.from?.id;

    if (!telegramId) {
      return;
    }

    const telegramUsername = ctx.message.from?.username ?? null;

    // Try to find existing user
    let user = await findUserByTelegramId(telegramId);

    if (!user) {
      // Auto-register new member (Req 11.3)
      user = await createUser({
        telegram_id: telegramId,
        username: telegramUsername,
        role: 'member',
      });
    }

    // Populate context with the user record
    ctx.user = user;

    await next();
  };
}
