// ============================================
// Horizon Trader Platform — Publish Handler Tests
// Updated for the draft-approval flow (publish-approval-flow spec)
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
    text: 'This is the original message content',
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
    replyWithMessageId: vi.fn().mockResolvedValue(1),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(999),
    ...overrides,
  };
}

/** Default mock draft article returned by findArticleByMessageId */
const mockDraftArticle = {
  id: 'article-uuid-draft',
  author_id: 'member-uuid-456',
  category: 'general' as const,
  status: 'draft',
  telegram_message_id: 42,
  bot_reply_message_id: 55,
  telegram_chat_id: -100123,
};

function createMockDeps(overrides: Partial<PublishHandlerDeps> = {}): PublishHandlerDeps {
  return {
    findArticleByMessageId: vi.fn().mockResolvedValue({ ...mockDraftArticle }),
    withTransaction: vi.fn().mockImplementation(async (fn) => fn('mock-client')),
    updateArticleStatus: vi.fn().mockResolvedValue(undefined),
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

  describe('admin permission enforcement (Req 2.6)', () => {
    it('should reject non-admin users with notification message', async () => {
      ctx.user = createMockUser({ role: 'member' });

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('admin'),
      );
      expect(deps.findArticleByMessageId).not.toHaveBeenCalled();
    });

    it('should allow admin users to proceed', async () => {
      await handler.execute(ctx);

      expect(deps.findArticleByMessageId).toHaveBeenCalled();
    });
  });

  describe('reply-to-message requirement (Req 2.7)', () => {
    it('should reject when not replying to a message', async () => {
      ctx.message.reply_to_message = undefined;

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('membalas pesan'),
      );
      expect(deps.findArticleByMessageId).not.toHaveBeenCalled();
    });
  });

  describe('article lookup by message ID (Req 2.1, 2.2)', () => {
    it('should look up article by replied-to message ID', async () => {
      await handler.execute(ctx);

      expect(deps.findArticleByMessageId).toHaveBeenCalledWith(42);
    });

    it('should reply "Pesan ini bukan artikel draft" when no article found', async () => {
      vi.mocked(deps.findArticleByMessageId).mockResolvedValue(null);

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Pesan ini bukan artikel draft');
    });
  });

  describe('draft status check (Req 2.3)', () => {
    it('should reply "Artikel sudah dipublikasikan" when article is not draft', async () => {
      vi.mocked(deps.findArticleByMessageId).mockResolvedValue({
        ...mockDraftArticle,
        status: 'published',
      });

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Artikel sudah dipublikasikan');
    });
  });

  describe('draft approval (Req 2.4, 2.5)', () => {
    it('should update article status to published inside a transaction', async () => {
      await handler.execute(ctx);

      expect(deps.withTransaction).toHaveBeenCalledTimes(1);
      expect(deps.updateArticleStatus).toHaveBeenCalledWith(
        'article-uuid-draft',
        'published',
        'mock-client',
      );
    });
  });

  describe('credit award to original author (Req 3.1, 3.2, 3.3, 3.4)', () => {
    it('should award credit to the original author, not the admin', async () => {
      await handler.execute(ctx);

      expect(deps.getCreditReward).toHaveBeenCalledWith('general', 'mock-client');
      expect(deps.insertCreditTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'member-uuid-456',
          amount: 3,
          transaction_type: 'earned',
          source_type: 'article_general',
          source_id: 'article-uuid-draft',
        }),
        'mock-client',
      );
      expect(deps.updateCreditBalance).toHaveBeenCalledWith('member-uuid-456', 3, 'mock-client');
    });

    it('should use correct source_type for trading category', async () => {
      vi.mocked(deps.findArticleByMessageId).mockResolvedValue({
        ...mockDraftArticle,
        category: 'trading',
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

  describe('message cleanup (Req 4.1, 4.2, 4.3, 4.4)', () => {
    it('should delete original member message', async () => {
      await handler.execute(ctx);

      expect(ctx.deleteMessage).toHaveBeenCalledWith(-100123, 42);
    });

    it('should delete bot reply message', async () => {
      await handler.execute(ctx);

      expect(ctx.deleteMessage).toHaveBeenCalledWith(-100123, 55);
    });

    it('should delete admin /publish command message', async () => {
      await handler.execute(ctx);

      expect(ctx.deleteMessage).toHaveBeenCalledWith(-100123, 100);
    });

    it('should send confirmation message', async () => {
      await handler.execute(ctx);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        -100123,
        expect.stringContaining('berhasil'),
      );
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
});
