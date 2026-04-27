// ============================================
// Horizon Trader Platform — Publish Handler (/publish)
// ============================================

import type { CommandHandler } from '../commands/types';
import type { BotContext } from '../middleware/types';
import type { ArticleCategory, SourceType } from '../../../shared/types/index';
import type { DbClient } from '../../../shared/db/query';

/**
 * Maps article categories to credit source types for transaction records.
 */
const CATEGORY_TO_SOURCE_TYPE: Record<string, SourceType> = {
  trading: 'article_trading',
  life_story: 'article_life_story',
  general: 'article_general',
};

/**
 * Dependencies injected into the PublishHandler for testability.
 * Each function represents a database or service operation.
 */
export interface PublishHandlerDeps {
  /** Find an article by its Telegram message ID */
  findArticleByMessageId: (
    telegramMessageId: number,
  ) => Promise<{
    id: string;
    author_id: string;
    category: ArticleCategory;
    status: string;
    telegram_message_id: number | null;
    bot_reply_message_id: number | null;
    telegram_chat_id: number | null;
  } | null>;

  /** Run a callback inside a database transaction */
  withTransaction: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;

  /** Update article status */
  updateArticleStatus: (
    articleId: string,
    status: string,
    client: DbClient,
  ) => Promise<void>;

  /** Look up the credit reward for a category */
  getCreditReward: (
    category: string,
    client: DbClient,
  ) => Promise<{ credit_reward: number; is_active: boolean } | null>;

  /** Insert a credit transaction record */
  insertCreditTransaction: (
    data: {
      user_id: string;
      amount: number;
      transaction_type: string;
      source_type: string;
      source_id: string;
      description: string | null;
    },
    client: DbClient,
  ) => Promise<void>;

  /** Update the user's credit balance atomically */
  updateCreditBalance: (
    userId: string,
    amount: number,
    client: DbClient,
  ) => Promise<void>;
}

/**
 * /publish command handler for the Telegram Bot.
 *
 * Admin-only command that approves an existing draft article by replying
 * to the original member message with `/publish`. The handler looks up
 * the article by `telegram_message_id`, transitions it to `published`,
 * and awards credits to the original author.
 *
 * Non-admin users receive a notification that only admins can use this command.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4
 */
export class PublishHandler implements CommandHandler {
  readonly name = '/publish';
  readonly description = 'Publikasikan pesan yang dibalas ke platform (admin only) — balas pesan dengan /publish';
  readonly permission = 'admin' as const;
  readonly type = 'command' as const;

  constructor(private readonly deps: PublishHandlerDeps) {}

  async execute(ctx: BotContext): Promise<void> {
    // Requirement 2.6: Admin-only check
    if (ctx.user.role !== 'admin') {
      await ctx.reply('Hanya admin yang dapat menggunakan command /publish.');
      return;
    }

    // Requirement 2.7: Must be a reply to a message
    if (!ctx.message.reply_to_message) {
      await ctx.reply('Gunakan /publish dengan membalas pesan yang ingin dipublikasikan.');
      return;
    }

    // Requirement 2.1: Look up the article by the replied-to message's ID
    const article = await this.deps.findArticleByMessageId(ctx.message.reply_to_message.message_id);

    // Requirement 2.2: No article found
    if (!article) {
      await ctx.reply('Pesan ini bukan artikel draft');
      return;
    }

    // Requirement 2.3: Must be a draft
    if (article.status !== 'draft') {
      await ctx.reply('Artikel sudah dipublikasikan');
      return;
    }

    // Requirements 2.4, 2.5, 3.1, 3.2, 3.3, 3.4: Approve the draft and award credits inside a transaction
    try {
      await this.deps.withTransaction(async (client) => {
        // Update article status to published
        await this.deps.updateArticleStatus(article.id, 'published', client);

        // Award credits to the ORIGINAL AUTHOR (not the approving admin)
        const creditSettings = await this.deps.getCreditReward(article.category, client);
        if (creditSettings && creditSettings.is_active && creditSettings.credit_reward > 0) {
          const sourceType = CATEGORY_TO_SOURCE_TYPE[article.category] ?? 'article_general';
          await this.deps.insertCreditTransaction(
            {
              user_id: article.author_id,
              amount: creditSettings.credit_reward,
              transaction_type: 'earned',
              source_type: sourceType,
              source_id: article.id,
              description: null,
            },
            client,
          );
          await this.deps.updateCreditBalance(
            article.author_id,
            creditSettings.credit_reward,
            client,
          );
        }
      });
    } catch (error) {
      await ctx.reply('Gagal mempublikasikan artikel. Silakan coba lagi.');
      throw error;
    }

    // Requirements 4.1, 4.2, 4.3, 4.4, 4.5: Message cleanup (all best-effort)
    // Delete original member message
    if (article.telegram_chat_id != null && article.telegram_message_id != null) {
      await ctx.deleteMessage(article.telegram_chat_id, article.telegram_message_id);
    }

    // Delete bot reply message
    if (article.telegram_chat_id != null && article.bot_reply_message_id != null) {
      await ctx.deleteMessage(article.telegram_chat_id, article.bot_reply_message_id);
    }

    // Delete admin's /publish command message
    await ctx.deleteMessage(ctx.message.chat.id, ctx.message.message_id);

    // Send confirmation and auto-delete after ~5 seconds (fire-and-forget)
    const chatId = ctx.message.chat.id;
    const confirmationId = await ctx.sendMessage(chatId, 'Artikel berhasil dipublikasikan!');
    setTimeout(async () => {
      await ctx.deleteMessage(chatId, confirmationId);
    }, 5000);
  }
}
