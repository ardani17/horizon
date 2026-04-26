// ============================================
// Horizon Trader Platform — Hashtag Handler Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HashtagHandler, type HashtagHandlerDeps } from '../../../bot/src/handlers/hashtagHandler';
import type { BotContext } from '../../../bot/src/middleware/types';
import type { User } from '../../../shared/types/index';

// ---- Test Helpers ----

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-123',
    telegram_id: 12345,
    username: 'testuser',
    password_hash: null,
    role: 'member',
    credit_balance: 0,
    created_at: new Date(),
    ...overrides,
  };
}

function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
  return {
    message: {
      message_id: 1,
      from: { id: 12345, is_bot: false, first_name: 'Test' },
      chat: { id: -100123, type: 'supergroup' },
      date: Math.floor(Date.now() / 1000),
      text: '#trading My trading journal entry for today',
    },
    user: createMockUser(),
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    replyWithMessageId: vi.fn().mockResolvedValue(1),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<HashtagHandlerDeps> = {}): HashtagHandlerDeps {
  return {
    withTransaction: vi.fn().mockImplementation(async (fn) => fn('mock-client')),
    insertArticle: vi.fn().mockResolvedValue({ id: 'article-uuid-456' }),
    insertMedia: vi.fn().mockResolvedValue(undefined),
    getCreditReward: vi.fn().mockResolvedValue({ credit_reward: 10, is_active: true }),
    insertCreditTransaction: vi.fn().mockResolvedValue(undefined),
    updateCreditBalance: vi.fn().mockResolvedValue(undefined),
    updateArticleReplyMessageId: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- Tests ----

describe('HashtagHandler', () => {
  let handler: HashtagHandler;
  let deps: HashtagHandlerDeps;
  let ctx: BotContext;

  beforeEach(() => {
    deps = createMockDeps();
    handler = new HashtagHandler(deps);
    ctx = createMockContext();
  });

  describe('interface compliance', () => {
    it('should implement CommandHandler interface with correct properties', () => {
      expect(handler.name).toBe('#hashtag');
      expect(handler.type).toBe('hashtag');
      expect(handler.permission).toBe('member');
      expect(handler.description).toBeTruthy();
    });
  });

  describe('article creation', () => {
    it('should create an article with category "trading" for #trading', async () => {
      ctx.message.text = '#trading EURUSD analysis for the week';
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'trading' }),
        'mock-client',
      );
    });

    it('should create an article with category "life_story" for #cerita', async () => {
      ctx.message.text = '#cerita Hari ini saya belajar sesuatu yang baru';
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'life_story' }),
        'mock-client',
      );
    });

    it('should create an article with category "general" when no recognized hashtag', async () => {
      ctx.message.text = '#random Some random content here';
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'general' }),
        'mock-client',
      );
    });

    it('should convert text to HTML for content_html', async () => {
      ctx.message.text = '#trading Hello world';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].content_html).toContain('<p>');
      expect(call[0].content_html).toContain('Hello world');
    });

    it('should generate a slug from the first 8 words', async () => {
      ctx.message.text = '#trading My trading journal entry for today is great';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].slug).toBeTruthy();
      expect(call[0].slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should set title from first 8 words of text', async () => {
      ctx.message.text = '#trading My trading journal entry for today is great and wonderful';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].title).toBeTruthy();
    });
  });

  describe('atomic transaction', () => {
    it('should execute all operations within a transaction', async () => {
      // Use admin user so credits are awarded (member drafts skip credit logic)
      ctx.user = createMockUser({ role: 'admin' });
      await handler.execute(ctx);

      expect(deps.withTransaction).toHaveBeenCalledTimes(1);
      expect(deps.insertArticle).toHaveBeenCalledWith(expect.anything(), 'mock-client');
      expect(deps.getCreditReward).toHaveBeenCalledWith(expect.any(String), 'mock-client');
      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(expect.anything(), 'mock-client');
      expect(deps.updateCreditBalance).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 'mock-client');
    });
  });

  describe('credit award', () => {
    it('should award credit based on category settings for admin', async () => {
      ctx.user = createMockUser({ role: 'admin' });
      ctx.message.text = '#trading Trading journal';
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 10, is_active: true });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: ctx.user.id,
          amount: 10,
          transaction_type: 'earned',
          source_type: 'article_trading',
          source_id: 'article-uuid-456',
        }),
        'mock-client',
      );
      expect(deps.updateCreditBalance).toHaveBeenCalledWith(ctx.user.id, 10, 'mock-client');
    });

    it('should use correct source_type for life_story category', async () => {
      ctx.user = createMockUser({ role: 'admin' });
      ctx.message.text = '#cerita My life story';
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 5, is_active: true });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: 'article_life_story',
          amount: 5,
        }),
        'mock-client',
      );
    });

    it('should use correct source_type for general category', async () => {
      ctx.user = createMockUser({ role: 'admin' });
      ctx.message.text = '#random General content';
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 3, is_active: true });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: 'article_general',
          amount: 3,
        }),
        'mock-client',
      );
    });

    it('should skip credit award when category reward is inactive', async () => {
      ctx.user = createMockUser({ role: 'admin' });
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 10, is_active: false });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).not.toHaveBeenCalled();
      expect(deps.updateCreditBalance).not.toHaveBeenCalled();
    });

    it('should skip credit award when credit_reward is 0', async () => {
      ctx.user = createMockUser({ role: 'admin' });
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 0, is_active: true });

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).not.toHaveBeenCalled();
      expect(deps.updateCreditBalance).not.toHaveBeenCalled();
    });

    it('should skip credit award when no credit settings found', async () => {
      ctx.user = createMockUser({ role: 'admin' });
      vi.mocked(deps.getCreditReward).mockResolvedValue(null);

      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).not.toHaveBeenCalled();
      expect(deps.updateCreditBalance).not.toHaveBeenCalled();
    });
  });

  describe('media handling', () => {
    it('should upload and insert photo media when present', async () => {
      const uploadMedia = vi.fn().mockResolvedValue({
        file_url: 'https://r2.example.com/photo.jpg',
        file_key: 'photos/photo.jpg',
        file_size: 50000,
      });
      deps = createMockDeps({ uploadMedia });
      handler = new HashtagHandler(deps);

      ctx.message.photo = [
        { file_id: 'small', file_unique_id: 's1', width: 100, height: 100 },
        { file_id: 'large', file_unique_id: 's2', width: 800, height: 600 },
      ];

      await handler.execute(ctx);

      expect(uploadMedia).toHaveBeenCalledWith('large', 'image');
      expect(deps.insertMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          article_id: 'article-uuid-456',
          file_url: 'https://r2.example.com/photo.jpg',
          media_type: 'image',
          file_key: 'photos/photo.jpg',
          file_size: 50000,
        }),
        'mock-client',
      );
    });

    it('should upload and insert video media when present', async () => {
      const uploadMedia = vi.fn().mockResolvedValue({
        file_url: 'https://r2.example.com/video.mp4',
        file_key: 'videos/video.mp4',
        file_size: 5000000,
      });
      deps = createMockDeps({ uploadMedia });
      handler = new HashtagHandler(deps);

      ctx.message.video = {
        file_id: 'vid1',
        file_unique_id: 'v1',
        width: 1920,
        height: 1080,
        duration: 30,
      };

      await handler.execute(ctx);

      expect(uploadMedia).toHaveBeenCalledWith('vid1', 'video');
      expect(deps.insertMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          article_id: 'article-uuid-456',
          file_url: 'https://r2.example.com/video.mp4',
          media_type: 'video',
        }),
        'mock-client',
      );
    });

    it('should continue publishing article when media upload fails', async () => {
      const uploadMedia = vi.fn().mockRejectedValue(new Error('Upload failed'));
      deps = createMockDeps({ uploadMedia });
      handler = new HashtagHandler(deps);

      ctx.message.photo = [
        { file_id: 'photo1', file_unique_id: 'p1', width: 800, height: 600 },
      ];

      await handler.execute(ctx);

      // Article should still be created
      expect(deps.insertArticle).toHaveBeenCalled();
      // Media insert should not be called since upload failed
      expect(deps.insertMedia).not.toHaveBeenCalled();
      // Success reply should still be sent (member draft uses replyWithMessageId)
      expect(ctx.replyWithMessageId).toHaveBeenCalledWith(expect.stringContaining('Kategori'));
    });

    it('should not attempt media upload when uploadMedia is not provided', async () => {
      // Default deps don't have uploadMedia
      ctx.message.photo = [
        { file_id: 'photo1', file_unique_id: 'p1', width: 800, height: 600 },
      ];

      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalled();
      expect(deps.insertMedia).not.toHaveBeenCalled();
    });

    it('should handle message without any media', async () => {
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalled();
      expect(deps.insertMedia).not.toHaveBeenCalled();
    });

    it('should skip media insert when uploadMedia returns null', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(null);
      deps = createMockDeps({ uploadMedia });
      handler = new HashtagHandler(deps);

      ctx.message.photo = [
        { file_id: 'photo1', file_unique_id: 'p1', width: 800, height: 600 },
      ];

      await handler.execute(ctx);

      expect(uploadMedia).toHaveBeenCalled();
      expect(deps.insertMedia).not.toHaveBeenCalled();
    });
  });

  describe('empty/missing text', () => {
    it('should reply with error when message text is empty', async () => {
      ctx.message.text = '';
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('tidak mengandung teks'));
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should reply with error when message text is whitespace only', async () => {
      ctx.message.text = '   ';
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('tidak mengandung teks'));
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should reply with error when message text is undefined', async () => {
      ctx.message.text = undefined;
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('tidak mengandung teks'));
      expect(deps.insertArticle).not.toHaveBeenCalled();
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
    it('should send success reply with category after member draft', async () => {
      ctx.message.text = '#trading My journal entry';
      await handler.execute(ctx);

      expect(ctx.replyWithMessageId).toHaveBeenCalledWith(
        expect.stringContaining('trading'),
      );
    });

    it('should include category name in member draft reply', async () => {
      ctx.message.text = '#cerita My story';
      await handler.execute(ctx);

      expect(ctx.replyWithMessageId).toHaveBeenCalledWith(
        expect.stringContaining('life_story'),
      );
    });

    it('should use ctx.replyWithMessageId for admin publishes and clean up messages', async () => {
      const mockReplyMessageId = 42;
      ctx.user = createMockUser({ role: 'admin' });
      ctx.message.text = '#trading Admin article';
      ctx.message.message_id = 10;
      ctx.message.chat.id = -100123;
      vi.mocked(ctx.replyWithMessageId).mockResolvedValue(mockReplyMessageId);

      await handler.execute(ctx);

      // Should use replyWithMessageId (not ctx.reply) for admin publishes
      expect(ctx.replyWithMessageId).toHaveBeenCalledWith(
        expect.stringContaining('dipublikasikan'),
      );
      // Should delete original admin message
      expect(ctx.deleteMessage).toHaveBeenCalledWith(-100123, 10);
      // Should delete bot reply message
      expect(ctx.deleteMessage).toHaveBeenCalledWith(-100123, mockReplyMessageId);
      expect(ctx.deleteMessage).toHaveBeenCalledTimes(2);
    });
  });
});
