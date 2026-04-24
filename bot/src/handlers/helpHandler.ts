// ============================================
// Horizon Trader Platform — Help Handler (/help)
// ============================================

import type { CommandHandler } from '../commands/types';
import type { BotContext } from '../middleware/types';

/**
 * Function signature for retrieving the list of registered commands.
 * Accepts a function (or bound method) that returns all registered handlers,
 * keeping the handler decoupled from the full CommandRegistry.
 */
export type ListCommandsFn = () => CommandHandler[];

/**
 * /help command handler for the Telegram Bot.
 *
 * Returns a formatted list of all available commands with their descriptions.
 * This handler is available to all users (no permission restriction).
 *
 * Validates: Requirements 15.8
 */
export class HelpHandler implements CommandHandler {
  readonly name = '/help';
  readonly description = 'Tampilkan daftar command yang tersedia';
  readonly permission = 'all' as const;
  readonly type = 'command' as const;

  constructor(private readonly listCommands: ListCommandsFn) {}

  async execute(ctx: BotContext): Promise<void> {
    const commands = this.listCommands();

    if (commands.length === 0) {
      await ctx.reply('Tidak ada command yang terdaftar saat ini.');
      return;
    }

    const lines: string[] = ['Daftar command yang tersedia:\n'];

    for (const cmd of commands) {
      lines.push(`${cmd.name} — ${cmd.description}`);
    }

    await ctx.reply(lines.join('\n'));
  }
}
