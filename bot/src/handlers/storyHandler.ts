// ============================================
// Horizon Trader Platform — Story Handler (/story)
// ============================================

import type { CommandHandler } from '../commands/types';
import type { BotContext } from '../middleware/types';
import { textToHtml } from '../../../shared/utils/textToHtml';
import { slugify, extractFirstWords } from '../../../shared/utils/slugify';
import type { SourceType } from '../../../shared/types/index';
import type { DbClient } from '../../../shared/db/query';

/**
 * Dependencies injected into the StoryHandler for testability.
 * Same interface as HashtagHandler deps (minus media, which is not needed here).
 */
export interface StoryHandlerDeps {
  /** Run a callback inside a database transaction */
  withTransaction: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;

  /** Insert an article record and return the created row (with id) */
  insertArticle: (
    data: {
      author_id: string;
      content_html: string;
      title: string | null;
      category: string;
      content_type: string;
      source: string;
      status: string;
      slug: string;
    },
    client: DbClient,
  ) => Promise<{ id: string }>;

  /** Look up the credit reward for a category. Returns null if inactive. */
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
 * Strip the leading command prefix (e.g., "/story") from message text.
 * Returns the remaining text trimmed of whitespace.
 */
export function stripCommandPrefix(text: string, command: string): string {
  if (text.startsWith(command)) {
    return text.slice(command.length).trim();
  }
  return text.trim();
}

/**
 * /story command handler for the Telegram Bot.
 *
 * Creates a short life_story article from the text following the /story command.
 * Converts text to HTML, generates a slug, and atomically inserts the article
 * and awards credit to the author.
 *
 * Validates: Requirements 8.3, 8.6
 */
export class StoryHandler implements CommandHandler {
  readonly name = '/story';
  readonly description = 'Buat cerita pendek (short post) — /story [teks]';
  readonly permission = 'member' as const;
  readonly type = 'command' as const;

  constructor(private readonly deps: StoryHandlerDeps) {}

  async execute(ctx: BotContext): Promise<void> {
    const rawText = ctx.message.text ?? '';
    const text = stripCommandPrefix(rawText, '/story');

    if (!text) {
      await ctx.reply('Pesan tidak mengandung teks untuk dipublikasikan. Gunakan: /story [teks cerita]');
      return;
    }

    const category = 'life_story';
    const contentType = 'short';
    const sourceType: SourceType = 'article_life_story';

    // Convert text to HTML
    const contentHtml = textToHtml(text);

    // Generate slug from first 8 words
    const slugInput = extractFirstWords(text);
    const slug = slugify(slugInput);

    // Generate title from first 8 words
    const title = extractFirstWords(text, 8);

    try {
      await this.deps.withTransaction(async (client) => {
        // Insert article
        const createdArticle = await this.deps.insertArticle(
          {
            author_id: ctx.user.id,
            content_html: contentHtml,
            title,
            category,
            content_type: contentType,
            source: 'telegram',
            status: 'published',
            slug,
          },
          client,
        );

        // Award credit based on category settings
        const creditSettings = await this.deps.getCreditReward(category, client);
        if (creditSettings && creditSettings.is_active && creditSettings.credit_reward > 0) {
          await this.deps.insertCreditTransaction(
            {
              user_id: ctx.user.id,
              amount: creditSettings.credit_reward,
              transaction_type: 'earned',
              source_type: sourceType,
              source_id: createdArticle.id,
              description: null,
            },
            client,
          );
          await this.deps.updateCreditBalance(
            ctx.user.id,
            creditSettings.credit_reward,
            client,
          );
        }

        return createdArticle;
      });

      await ctx.reply('Cerita pendek berhasil dipublikasikan! Kategori: life_story.');
    } catch (error) {
      await ctx.reply('Gagal mempublikasikan cerita. Silakan coba lagi.');
      throw error;
    }
  }
}
