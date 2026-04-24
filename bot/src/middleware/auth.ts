// ============================================
// Horizon Trader Platform — Auth Middleware
// ============================================

import type { MiddlewareFn } from './types';

/**
 * Options for the auth middleware.
 */
export interface AuthMiddlewareOptions {
  /**
   * The Telegram group/supergroup chat ID that members must belong to.
   * Typically set from the HORIZON_GROUP_CHAT_ID environment variable.
   */
  groupChatId: number;
  /**
   * Function to check if a user is a member of the group.
   * Receives the group chat ID and the user's Telegram ID.
   * Returns true if the user is an active member.
   *
   * This is injected to keep the middleware testable without
   * depending on the Telegram Bot API directly.
   */
  checkMembership: (chatId: number, userId: number) => Promise<boolean>;
}

/**
 * Auth middleware: validates that the message sender is a member of the
 * Horizon Telegram group before allowing the pipeline to continue.
 *
 * If the sender is not a group member, the pipeline halts silently
 * (no article is created, per Requirement 11.2).
 *
 * Validates: Requirements 11.1, 11.2, 11.6
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions): MiddlewareFn {
  const { groupChatId, checkMembership } = options;

  return async (ctx, next) => {
    const senderId = ctx.message.from?.id;

    // No sender info — cannot validate membership
    if (!senderId) {
      return;
    }

    const isMember = await checkMembership(groupChatId, senderId);

    if (!isMember) {
      // Silently ignore messages from non-members (Req 11.2)
      return;
    }

    await next();
  };
}
