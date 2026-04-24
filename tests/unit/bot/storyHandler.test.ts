// ============================================
// Horizon Trader Platform — Story Handler Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryHandler, stripCommandPrefix, type StoryHandlerDeps } from '../../../bot/src/handlers/storyHandler';
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
      text: '/story My short story about trading life',
    },
    user: createMockUser(),
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<StoryHandlerDeps> = {}): StoryHandlerDeps {
  return {
    withTransaction: vi.fn().mockImplementation(async (fn) => fn('mock-client')),
    insertArticle: vi.fn().mockResolvedValue({ id: 'article-uuid-789' }),
    getCreditReward: vi.fn().mockResolvedValue({ credit_reward: 5, is_active: true }),
    insertCreditTransaction: vi.fn().mockResolvedValue(undefined),
    updateCreditBalance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- Tests ----

describe('StoryHandler', () => {
  let handler: StoryHandler;
  let deps: StoryHandlerDeps;
  let ctx: BotContext;

  beforeEach(() => {
    deps = createMockDeps();
    handler = new StoryHandler(deps);
    ctx = createMockContext();
  });

  describe('interface compliance', () => {
    it('should implement CommandHandler interface with correct properties', () => {
      expect(handler.name).toBe('/story');
      expect(handler.type).toBe('command');
      expect(handler.permission).toBe('member');
      expect(handler.description).toBeTruthy();
    });
  });

  describe('command prefix stripping', () => {
    it('should strip /story prefix from message text', () => {
      expect(stripCommandPrefix('/story Hello world', '/story')).toBe('Hello world');
    });

    it('should handle text without the prefix', () => {
      expect(stripCommandPrefix('Hello world', '/story')).toBe('Hello world');
    });

    it('should trim whitespace after stripping', () => {
      expect(stripCommandPrefix('/story   Hello world', '/story')).toBe('Hello world');
    });

    it('should return empty string when only command is present', () => {
      expect(stripCommandPrefix('/story', '/story')).toBe('');
    });

    it('should return empty string for command with trailing spaces', () => {
      expect(stripCommandPrefix('/story   ', '/story')).toBe('');
    });
  });

  describe('article creation', () => {
    it('should create an article with category "life_story" and content_type "short"', async () => {
      await handler.execute(ctx);

      expect(deps.insertArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          author_id: 'user-uuid-123',
          category: 'life_story',
          content_type: 'short',
          source: 'telegram',
          status: 'published',
        }),
        'mock-client',
      );
    });

    it('should strip /story prefix before converting to HTML', async () => {
      ctx.message.text = '/story My short story content';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].content_html).toContain('My short story content');
      expect(call[0].content_html).not.toContain('/story');
    });

    it('should convert text to HTML for content_html', async () => {
      ctx.message.text = '/story Hello world';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].content_html).toContain('<p>');
      expect(call[0].content_html).toContain('Hello world');
    });

    it('should generate a valid slug', async () => {
      ctx.message.text = '/story My short story about trading life';
      await handler.execute(ctx);

      const call = vi.mocked(deps.insertArticle).mock.calls[0];
      expect(call[0].slug).toBeTruthy();
      expect(call[0].slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should set title from first 8 words of content (excluding command)', async () => {
      ctx.message.text = '/story One two three four five six seven eight nine ten';
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
          user_id: 'user-uuid-123',
          amount: 5,
          transaction_type: 'earned',
          source_type: 'article_life_story',
          source_id: 'article-uuid-789',
        }),
        'mock-client',
      );
      expect(deps.updateCreditBalance).toHaveBeenCalledWith('user-uuid-123', 5, 'mock-client');
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
      ctx.message.text = '/story';
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/story'));
      expect(deps.insertArticle).not.toHaveBeenCalled();
    });

    it('should reply with error when command has only whitespace after it', async () => {
      ctx.message.text = '/story   ';
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

    it('should mention "cerita pendek" in success reply', async () => {
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Cerita pendek'),
      );
    });
  });
});
