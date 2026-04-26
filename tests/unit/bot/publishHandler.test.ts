// ============================================
// Horizon Trader Platform — Publish Handler Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishHandler, type PublishHandlerDeps } from '../../../bot/src/handlers/publishHandler';
import type { BotContext } from '../../../bot/src/middleware/types';
import type { TelegramMessage } from '../../../bot/src/middleware/types';
import type { User } from '../../../shared/types/index';

// ---- Test Helpers ----

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'admin-uuid-123',
    telegram_id: 99999,
    username: 'adminuser',
    password_hash: 'hashed',
    role: 'admin',
    credit_balance: 100,
    created_at: new Date(),
    ...overrides,
  };
}

function createRepliedMessage(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    message_id: 42,
    from: { id: 12345, is_bot: false, first_name: 'OriginalSender' },
    chat: { id: -100123, type: 'supergroup' },
    date: Math.floor(Date.now() / 1000),
    text: 'This is the original message content to publish',
    ...overrides,
  };
}

function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
  return {
    message: {
      message_id: 100,
      from: { id: 99999, is_bot: false, first_name: 'Admin' },
      chat: { id: -100123, type: 'supergroup' },
      date: Math.floor(Date.now() / 1000),
      text: '/publish',
      reply_to_message: createRepliedMessage(),
    },
    user: createMockUser(),
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<PublishHandlerDeps> = {}): PublishHandlerDeps {
  return {
    withTransaction: vi.fn().mockImplementation(async (fn) => fn('mock-client')),
    insertArticle: vi.fn().mockResolvedValue({ id: 'article-uuid-publish' }),
    insertMedia: vi.fn().mockResolvedValue(undefined),
    getCreditReward: vi.fn().mockResolvedValue({ credit_reward: 3, is_active: true }),
    insertCreditTransaction: vi.fn().mockResolvedValue(undefined),
    updateCreditBalance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- Tests ----

describe('PublishHandler', () => {
  let handler: PublishHandler;
  let deps: PublishHandlerDeps;
  let ctx: BotContext;

  beforeEach(() => {
    deps = createMockDeps();
    handler = new PublishHandler(deps);
    ctx = createMockContext();
  });

  describe('interface compliance', () => {
    it('should implement CommandHandler interface with correct properties', () => {
      expect(handler.name).toBe('/publish');
      expect(handler.type).toBe('command');
      expect(handler.permission).toBe('admin');
      expect(handler.description).toBeTruthy();
    });
  });

  describe('admin permission enforcement (Req 9.4)', () => {
    it('should reject non-admin users with notification message', async () => {
      ctx.user = createMockUser({ role: 'member' });

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('admin'),
      );
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should allow admin users to proceed', async () => {
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalled();
    });
  });

  describe('reply-to-message requirement (Req 9.1)', () => {
    it('should reject when not replying to a message', async () => {
      ctx.message.reply_to_message = undefined;

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('membalas pesan'),
      );
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should reject when replied message has no text', async () => {
      ctx.message.reply_to_message = createRepliedMessage({ text: undefined });

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('tidak mengandung teks'),
      );
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should reject when replied message has only whitespace', async () => {
      ctx.message.reply_to_message = createRepliedMessage({ text: '   ' });

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('tidak mengandung teks'),
      );
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });
  });

  describe('category from hashtags (Req 9.2, 9.3)', () => {
    it('should default to "general" when no hashtags in replied message', async () => {
      ctx.message.reply_to_message = createRepliedMessage({
        text: 'A message without any hashtags',
      });

      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].category).toBe('general');
    });

    it('should map #trading to "trading" category', async () => {
      ctx.message.reply_to_message = createRepliedMessage({
        text: 'My trading journal #trading for today',
      });

      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].category).toBe('trading');
    });

    it('should map #cerita to "life_story" category', async () => {
      ctx.message.reply_to_message = createRepliedMessage({
        text: 'A personal story #cerita about my journey',
      });

      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].category).toBe('life_story');
    });
  });

  describe('article creation from replied message', () => {
    it('should create article from replied message content', async () => {
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          author_id: 'admin-uuid-123',
          source: 'telegram',
          status: 'published',
        }),
        'mock-client',
      );
    });

    it('should convert replied message text to HTML', async () => {
      ctx.message.reply_to_message = createRepliedMessage({
        text: 'Hello world from the original message',
      });

      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].content_html).toContain('<p>');
      expect(call[0].content_html).toContain('Hello world from the original message');
    });

    it('should generate a valid slug from replied message text', async () => {
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].slug).toBeTruthy();
      expect(call[0].slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should set title from first 8 words of replied message', async () => {
      ctx.message.reply_to_message = createRepliedMessage({
        text: 'One two three four five six seven eight nine ten',
      });

      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].title).toBe('One two three four five six seven eight');
    });
  });

  describe('atomic transaction', () => {
    it('should execute all operations within a transaction', async () => {
      await handler.execute(ctx);

      expect(deps.withTransaction).toHaveBeenCalledTimes(1);
      expect(deps.insertArticle).toHaveBeenCalledWith(expect.anything(), 'mock-client');
    });
  });

  describe('credit award', () => {
    it('should award credit based on category', async () => {
      await handler.execute(ctx);

      expect(deps.getCreditReward).toHaveBeenCalledWith('general', 'mock-client');
      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'admin-uuid-123',
          amount: 3,
          transaction_type: 'earned',
          source_type: 'article_general',
          source_id: 'article-uuid-publish',
        }),
        'mock-client',
      );
      expect(deps.updateCreditBalance).toHaveBeenCalledWith('admin-uuid-123', 3, 'mock-client');
    });

    it('should use correct source_type for trading category', async () => {
      ctx.message.reply_to_message = createRepliedMessage({
        text: 'Trading journal #trading',
      });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: 'article_trading',
        }),
        'mock-client',
      );
    });

    it('should skip credit award when category reward is inactive', async () => {
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 3, is_active: false });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).not.toHaveBeenCalled();
      expect(deps.updateCreditBalance).not.toHaveBeenCalled();
    });

    it('should skip credit award when credit_reward is 0', async () => {
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 0, is_active: true });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).not.toHaveBeenCalled();
      expect(deps.updateCreditBalance).not.toHaveBeenCalled();
    });

    it('should skip credit award when no credit settings found', async () => {
      vi.mocked(deps.getCreditReward).mockResolvedValue(null);

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).not.toHaveBeenCalled();
      expect(deps.updateCreditBalance).not.toHaveBeenCalled();
    });
  });

  describe('media handling from replied message', () => {
    it('should upload photo from replied message when uploadMedia is available', async () => {
      const mockUploadMedia = vi.fn().mockResolvedValue({
        file_url: 'https://r2.example.com/photo.jpg',
        file_key: 'photo-key',
        file_size: 12345,
      });
      deps.uploadMedia = mockUploadMedia;

      ctx.message.reply_to_message = createRepliedMessage({
        text: 'Photo message',
        photo: [
          { file_id: 'small-photo', file_unique_id: 'u1', width: 100, height: 100 },
          { file_id: 'large-photo', file_unique_id: 'u2', width: 800, height: 600 },
        ],
      });

      await handler.execute(ctx);

      expect(mockUploadMedia).toHaveBeenCalledWith('large-photo', 'image');
      expect(deps.insertMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          article_id: 'article-uuid-publish',
          file_url: 'https://r2.example.com/photo.jpg',
          media_type: 'image',
        }),
        'mock-client',
      );
    });

    it('should upload video from replied message when uploadMedia is available', async () => {
      const mockUploadMedia = vi.fn().mockResolvedValue({
        file_url: 'https://r2.example.com/video.mp4',
        file_key: 'video-key',
        file_size: 99999,
      });
      deps.uploadMedia = mockUploadMedia;

      ctx.message.reply_to_message = createRepliedMessage({
        text: 'Video message',
        video: { file_id: 'video-id', file_unique_id: 'vu1', width: 1920, height: 1080, duration: 30 },
      });

      await handler.execute(ctx);

      expect(mockUploadMedia).toHaveBeenCalledWith('video-id', 'video');
      expect(deps.insertMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          article_id: 'article-uuid-publish',
          file_url: 'https://r2.example.com/video.mp4',
          media_type: 'video',
        }),
        'mock-client',
      );
    });

    it('should continue publishing article when media upload fails', async () => {
      deps.uploadMedia = vi.fn().mockRejectedValue(new Error('Upload failed'));

      ctx.message.reply_to_message = createRepliedMessage({
        text: 'Photo message with failing upload',
        photo: [
          { file_id: 'photo-id', file_unique_id: 'u1', width: 800, height: 600 },
        ],
      });

      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('berhasil'));
    });

    it('should not attempt media upload when uploadMedia is not provided', async () => {
      deps.uploadMedia = undefined;

      ctx.message.reply_to_message = createRepliedMessage({
        text: 'Photo message',
        photo: [
          { file_id: 'photo-id', file_unique_id: 'u1', width: 800, height: 600 },
        ],
      });

      await handler.execute(ctx);

      expect(deps.insertMedia).not.toHaveBeenCalled();
      expect(deps.insertArticle).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should reply with error message when transaction fails', async () => {
      vi.mocked(deps.withTransaction).mockRejectedValue(new Error('DB error'));

      await expect(handler.execute(ctx)).rejects.toThrow('DB error');
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Gagal'));
    });

    it('should re-throw the error after replying', async () => {
      const dbError = new Error('Connection lost');
      vi.mocked(deps.withTransaction).mockRejectedValue(dbError);

      await expect(handler.execute(ctx)).rejects.toThrow('Connection lost');
    });
  });

  describe('reply messages', () => {
    it('should send success reply mentioning the category', async () => {
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('general'),
      );
    });

    it('should mention "berhasil" in success reply', async () => {
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('berhasil'),
      );
    });
  });
});
