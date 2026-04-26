// ============================================
// Horizon Trader Platform — Command Types
// ============================================

import type { BotContext } from '../middleware/types';

/**
 * A command handler that can be registered with the CommandRegistry.
 *
 * Each handler defines a name (e.g., "/publish", "#trading"), a human-readable
 * description, a permission level, a type (command or hashtag), and an
 * execute function that processes the bot context.
 *
 * Validates: Requirements 15.1, 15.2
 */
export interface CommandHandler {
  /** Command or hashtag name, e.g., "/publish", "#trading" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Permission level required to execute this handler */
  permission: 'admin' | 'member' | 'all';
  /** Whether this is a slash command or a hashtag trigger */
  type: 'command' | 'hashtag';
  /** Execute the handler with the given bot context */
  execute(ctx: BotContext): Promise<void>;
}

/**
 * Registry for command handlers. Supports registration, resolution from
 * incoming messages, and listing all registered handlers.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.8
 */
export interface ICommandRegistry {
  /** Register a command handler */
  register(handler: CommandHandler): void;
  /** Resolve a Telegram message to a matching handler, or null if none matches */
  resolve(message: import('../middleware/types').TelegramMessage): CommandHandler | null;
  /** List all registered command handlers */
  listCommands(): CommandHandler[];
}
