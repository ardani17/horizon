// ============================================
// Horizon Trader Platform — Hashtag Handler
// ============================================

import type { CommandHandler } from '../commands/types';
import type { BotContext } from '../middleware/types';
import { parseHashtags, mapHashtagToCategory } from '../utils/hashtag';
import { textToHtml } from '../../../shared/utils/textToHtml';
import { slugify, extractFirstWords } from '../../../shared/utils/slugify';
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
 * Dependencies injected into the HashtagHandler for testability.
 * Each function represents a database or service operation.
 */
export interface HashtagHandlerDeps {
  /** Run a callback inside a database transaction */
  withTransaction: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;

  /** Insert an article record and return the created row (with id) */
  insertArticle: (
    data: {
      author_id: string;
      content_html: string;
      title: string | null;
      category: ArticleCategory;
      content_type: string;
      source: string;
      status: string;
      slug: string;
    },
    client: DbClient,
  ) => Promise<{ id: string }>;

  /** Insert a media record linked to an article */
  insertMedia: (
    data: {
      article_id: string;
      file_url: string;
      media_type: string;
      file_key: string | null;
      file_size: number | null;
    },
    client: DbClient,
  ) => Promise<void>;

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

  /** Download media from Telegram and upload to storage. Returns file metadata. */
  uploadMedia?: (
    fileId: string,
    mediaType: 'image' | 'video',
  ) => Promise<{ file_url: string; file_key: string; file_size: number } | null>;
}

/**
 * Hashtag handler for the Telegram Bot.
 *
 * Triggered when a message contains a recognized hashtag (#jurnal, #trading,
 * #cerita, #kehidupan). Parses the hashtag to determine the article category,
 * converts the message text to HTML, generates a slug, and atomically inserts
 * the article and awards credit to the author.
 *
 * Validates: Requirements 8.1, 8.2, 8.5
 */
export class HashtagHandler implements CommandHandler {
  readonly name = '#hashtag';
  readonly description = 'Publish article via hashtag (#jurnal, #trading, #cerita, #kehidupan)';
  readonly permission = 'member' as const;
  readonly type = 'hashtag' as const;

  constructor(private readonly deps: HashtagHandlerDeps) {}

  async execute(ctx: BotContext): Promise<void> {
    const text = ctx.message.text ?? '';
    if (!text.trim()) {
      await ctx.reply('Pesan tidak mengandung teks untuk dipublikasikan.');
      return;
    }

    // Step 1: Parse hashtags and determine category
    const hashtags = parseHashtags(text);
    const category = mapHashtagToCategory(hashtags);

    // Step 2: Convert text to HTML
    const contentHtml = textToHtml(text);

    // Step 3: Generate slug from first 8 words
    const slugInput = extractFirstWords(text);
    const slug = slugify(slugInput);

    // Step 4: Generate a title from the first 8 words (nullable per schema)
    const title = extractFirstWords(text, 8);

    // Step 5: Determine if message has media
    const hasPhoto = ctx.message.photo && ctx.message.photo.length > 0;
    const hasVideo = !!ctx.message.video;

    try {
      const article = await this.deps.withTransaction(async (client) => {
        // Insert article
        const createdArticle = await this.deps.insertArticle(
          {
            author_id: ctx.user.id,
            content_html: contentHtml,
            title,
            category,
            content_type: 'short',
            source: 'telegram',
            status: 'published',
            slug,
          },
          client,
        );

        // Handle media attachments
        if (this.deps.uploadMedia) {
          if (hasPhoto) {
            // Use the largest photo (last in array)
            const photo = ctx.message.photo![ctx.message.photo!.length - 1];
            try {
              const mediaResult = await this.deps.uploadMedia(photo.file_id, 'image');
              if (mediaResult) {
                await this.deps.insertMedia(
                  {
                    article_id: createdArticle.id,
                    file_url: mediaResult.file_url,
                    media_type: 'image',
                    file_key: mediaResult.file_key,
                    file_size: mediaResult.file_size,
                  },
                  client,
                );
              }
            } catch {
              // Media upload failure: log and continue (Req 10.4)
            }
          }

          if (hasVideo) {
            try {
              const mediaResult = await this.deps.uploadMedia(ctx.message.video!.file_id, 'video');
              if (mediaResult) {
                await this.deps.insertMedia(
                  {
                    article_id: createdArticle.id,
                    file_url: mediaResult.file_url,
                    media_type: 'video',
                    file_key: mediaResult.file_key,
                    file_size: mediaResult.file_size,
                  },
                  client,
                );
              }
            } catch {
              // Media upload failure: log and continue (Req 10.4)
            }
          }
        }

        // Award credit based on category settings
        const creditSettings = await this.deps.getCreditReward(category, client);
        if (creditSettings && creditSettings.is_active && creditSettings.credit_reward > 0) {
          const sourceType = CATEGORY_TO_SOURCE_TYPE[category] ?? 'article_general';
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

      await ctx.reply(`Artikel berhasil dipublikasikan! Kategori: ${category}.`);
    } catch (error) {
      await ctx.reply('Gagal mempublikasikan artikel. Silakan coba lagi.');
      throw error;
    }
  }
}
