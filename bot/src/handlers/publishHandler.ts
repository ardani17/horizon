// ============================================
// Horizon Trader Platform — Publish Handler (/publish)
// ============================================

import type { CommandHandler } from '../commands/types';
import type { BotContext } from '../middleware/types';
import { parseHashtags, mapHashtagToCategory, stripRecognizedHashtags } from '../utils/hashtag';
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
 * Dependencies injected into the PublishHandler for testability.
 * Each function represents a database or service operation.
 */
export interface PublishHandlerDeps {
  /** Run a callback inside a database transaction */
  withTransaction: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;

  /** Insert an article record and return the created row (with id) */
  insertArticle: (
    data: {
      author_id: string;
      content_html: string;
      title: string | null;
      category: ArticleCategory;
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
 * /publish command handler for the Telegram Bot.
 *
 * Admin-only command that publishes a replied-to message as an article.
 * The admin replies to any message in the group with `/publish`, and the
 * bot creates an article from the replied-to message content. Category is
 * determined from hashtags in the replied-to message, defaulting to "general".
 *
 * Non-admin users receive a notification that only admins can use this command.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export class PublishHandler implements CommandHandler {
  readonly name = '/publish';
  readonly description = 'Publikasikan pesan yang dibalas ke platform (admin only) — balas pesan dengan /publish';
  readonly permission = 'admin' as const;
  readonly type = 'command' as const;

  constructor(private readonly deps: PublishHandlerDeps) {}

  async execute(ctx: BotContext): Promise<void> {
    // Requirement 9.4: Reject non-admin users
    if (ctx.user.role !== 'admin') {
      await ctx.reply('Hanya admin yang dapat menggunakan command /publish.');
      return;
    }

    // Requirement 9.1: Must be used as a reply to another message
    const repliedMessage = ctx.message.reply_to_message;
    if (!repliedMessage) {
      await ctx.reply('Gunakan /publish dengan membalas pesan yang ingin dipublikasikan.');
      return;
    }

    const text = repliedMessage.text ?? '';
    if (!text.trim()) {
      await ctx.reply('Pesan yang dibalas tidak mengandung teks untuk dipublikasikan.');
      return;
    }

    // Requirement 9.2, 9.3: Determine category from hashtags, default "general"
    const hashtags = parseHashtags(text);
    const category = mapHashtagToCategory(hashtags);

    // Strip recognized hashtags before converting to HTML (Requirement 10.5)
    const cleanedText = stripRecognizedHashtags(text);

    // Convert cleaned text to HTML
    const contentHtml = textToHtml(cleanedText);

    // Generate slug from first 8 words
    const slugInput = extractFirstWords(text);
    const slug = slugify(slugInput);

    // Generate title from first 8 words
    const title = extractFirstWords(text, 8);

    // Determine if replied message has media
    const hasPhoto = repliedMessage.photo && repliedMessage.photo.length > 0;
    const hasVideo = !!repliedMessage.video;

    try {
      await this.deps.withTransaction(async (client) => {
        // Insert article with the admin as author
        const createdArticle = await this.deps.insertArticle(
          {
            author_id: ctx.user.id,
            content_html: contentHtml,
            title,
            category,
            source: 'telegram',
            status: 'published',
            slug,
          },
          client,
        );

        // Handle media attachments from the replied-to message
        if (this.deps.uploadMedia) {
          if (hasPhoto) {
            const photo = repliedMessage.photo![repliedMessage.photo!.length - 1];
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
              const mediaResult = await this.deps.uploadMedia(repliedMessage.video!.file_id, 'video');
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
