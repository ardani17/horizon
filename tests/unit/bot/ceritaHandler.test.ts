// ============================================
// Horizon Trader Platform — Cerita Handler Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CeritaHandler, type CeritaHandlerDeps } from '../../../bot/src/handlers/ceritaHandler';
import type { BotContext } from '../../../bot/src/middleware/types';
import type { User } from '../../../shared/types/index';

// ---- Test Helpers ----

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-456',
    telegram_id: 67890,
    username: 'ceritauser',
    password_hash: null,
    role: 'member',
    credit_balance: 10,
    created_at: new Date(),
    ...overrides,
  };
}

function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
  return {
    message: {
      message_id: 2,
      from: { id: 67890, is_bot: false, first_name: 'Cerita' },
      chat: { id: -100123, type: 'supergroup' },
      date: Math.floor(Date.now() / 1000),
      text: '/cerita Hari ini saya belajar sesuatu yang sangat berharga tentang kehidupan dan trading',
    },
    user: createMockUser(),
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<CeritaHandlerDeps> = {}): CeritaHandlerDeps {
  return {
    withTransaction: vi.fn().mockImplementation(async (fn) => fn('mock-client')),
    insertArticle: vi.fn().mockResolvedValue({ id: 'article-uuid-long-001' }),
    getCreditReward: vi.fn().mockResolvedValue({ credit_reward: 5, is_active: true }),
    insertCreditTransaction: vi.fn().mockResolvedValue(undefined),
    updateCreditBalance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- Tests ----

describe('CeritaHandler', () => {
  let handler: CeritaHandler;
  let deps: CeritaHandlerDeps;
  let ctx: BotContext;

  beforeEach(() => {
    deps = createMockDeps();
    handler = new CeritaHandler(deps);
    ctx = createMockContext();
  });

  describe('interface compliance', () => {
    it('should implement CommandHandler interface with correct properties', () => {
      expect(handler.name).toBe('/cerita');
      expect(handler.type).toBe('command');
      expect(handler.permission).toBe('member');
      expect(handler.description).toBeTruthy();
    });
  });

  describe('article creation', () => {
    it('should create an article with category "life_story" and content_type "long"', async () => {
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          author_id: 'user-uuid-456',
          category: 'life_story',
          content_type: 'long',
          source: 'telegram',
          status: 'published',
        }),
        'mock-client',
      );
    });

    it('should strip /cerita prefix before converting to HTML', async () => {
      ctx.message.text = '/cerita My long story content here';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].content_html).toContain('My long story content here');
      expect(call[0].content_html).not.toContain('/cerita');
    });

    it('should convert text to HTML for content_html', async () => {
      ctx.message.text = '/cerita Hello world from cerita';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].content_html).toContain('<p>');
      expect(call[0].content_html).toContain('Hello world from cerita');
    });

    it('should generate a valid slug', async () => {
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].slug).toBeTruthy();
      expect(call[0].slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should set title from first 8 words of content (excluding command)', async () => {
      ctx.message.text = '/cerita One two three four five six seven eight nine ten';
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
      expect(deps.getCreditReward).toHaveBeenCalledWith('life_story', 'mock-client');
    });
  });

  describe('credit award', () => {
    it('should award credit with source_type "article_life_story"', async () => {
      await handler.execute(ctx);

      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-uuid-456',
          amount: 5,
          transaction_type: 'earned',
          source_type: 'article_life_story',
          source_id: 'article-uuid-long-001',
        }),
        'mock-client',
      );
      expect(deps.updateCreditBalance).toHaveBeenCalledWith('user-uuid-456', 5, 'mock-client');
    });

    it('should skip credit award when category reward is inactive', async () => {
      vi.mocked(deps.getCreditReward).mockResolvedValue({ credit_reward: 5, is_active: false });

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

  describe('empty/missing text', () => {
    it('should reply with usage hint when only command is sent', async () => {
      ctx.message.text = '/cerita';
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/cerita'));
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should reply with error when command has only whitespace after it', async () => {
      ctx.message.text = '/cerita   ';
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
    it('should send success reply mentioning life_story category', async () => {
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('life_story'),
      );
    });

    it('should mention "cerita panjang" in success reply', async () => {
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Cerita panjang'),
      );
    });
  });
});
