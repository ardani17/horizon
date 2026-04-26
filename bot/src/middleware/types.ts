// ============================================
// Horizon Trader Platform — Bot Middleware Types
// ============================================

import type { User } from '../../../shared/types/index';
import type { AppError } from '../../../shared/utils/errors';

/**
 * Represents a Telegram message received via webhook.
 *
 * This is a simplified subset of the Telegram Bot API Message type,
 * containing only the fields needed by the middleware pipeline and
 * command handlers.
 */
export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
  };
  date: number;
  text?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
  video?: { file_id: string; file_unique_id: string; width: number; height: number; duration: number; file_size?: number };
  reply_to_message?: TelegramMessage;
}

/**
 * Context object passed through the middleware pipeline and into command handlers.
 *
 * Validates: Requirements 15.7
 */
export interface BotContext {
  /** The incoming Telegram message */
  message: TelegramMessage;
  /** The authenticated user record (populated by auto-register middleware) */
  user: User;
  /** Send a text reply to the chat */
  reply(text: string): Promise<void>;
  /** Send a formatted error reply to the chat */
  replyWithError(error: AppError): Promise<void>;
  /** Send a text reply and return the sent message's message_id for tracking */
  replyWithMessageId(text: string): Promise<number>;
  /** Delete a message in any chat (best-effort, never throws) */
  deleteMessage(chatId: number, messageId: number): Promise<void>;
  /** Send a message to any chat and return the sent message's message_id */
  sendMessage(chatId: number, text: string): Promise<number>;
}

/**
 * A middleware function that receives a context and a next callback.
 * Calling `next()` passes control to the next middleware in the pipeline.
 *
 * Validates: Requirements 15.7
 */
export type MiddlewareFn = (ctx: BotContext, next: () => Promise<void>) => Promise<void>;
