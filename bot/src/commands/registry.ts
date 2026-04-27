// ============================================
// Horizon Trader Platform — Command Registry
// ============================================

import type { TelegramMessage } from '../middleware/types';
import type { CommandHandler, ICommandRegistry } from './types';

/**
 * Registry for bot command handlers using the registry pattern.
 *
 * Supports two handler types:
 * - **command**: Slash commands like `/publish`, `/help`.
 *   Matched against the first word of the message text.
 * - **hashtag**: Hashtag triggers like `#trading`, `#cerita`.
 *   Matched against any hashtag found in the message text.
 *
 * Unregistered commands or messages without matching triggers resolve to null.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.8
 */
export class CommandRegistry implements ICommandRegistry {
  private readonly handlers: Map<string, CommandHandler> = new Map();

  /**
   * Register a command handler. The handler's name is used as the lookup key
   * (lowercased for case-insensitive matching). Registering a handler with
   * the same name as an existing one replaces the previous handler.
   */
  register(handler: CommandHandler): void {
    const key = handler.name.toLowerCase();
    this.handlers.set(key, handler);
  }

  /**
   * Resolve an incoming Telegram message to a registered handler.
   *
   * Resolution strategy:
   * 1. If the message text starts with `/`, extract the command name
   *    (first word, lowercased) and look it up in the registry.
   * 2. Otherwise, scan the message text for hashtags and return the
   *    first matching registered hashtag handler.
   * 3. Return null if no handler matches.
   */
  resolve(message: TelegramMessage): CommandHandler | null {
    const text = (message.text ?? message.caption)?.trim();
    if (!text) {
      return null;
    }

    // Check for slash command (first word starting with /)
    if (text.startsWith('/')) {
      const commandName = text.split(/\s+/)[0].toLowerCase();
      // Strip @botname suffix if present (e.g., /publish@HorizonBot → /publish)
      const cleanCommand = commandName.split('@')[0];
      const handler = this.handlers.get(cleanCommand);
      return handler && handler.type === 'command' ? handler : null;
    }

    // Check for hashtag triggers anywhere in the message
    const hashtags = extractHashtags(text);
    for (const hashtag of hashtags) {
      const handler = this.handlers.get(hashtag.toLowerCase());
      if (handler && handler.type === 'hashtag') {
        return handler;
      }
    }

    return null;
  }

  /**
   * Return all registered command handlers.
   */
  listCommands(): CommandHandler[] {
    return Array.from(this.handlers.values());
  }
}

/**
 * Extract hashtags from a text string.
 * Returns an array of hashtags including the `#` prefix, e.g., ["#trading", "#cerita"].
 */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches ?? [];
}
