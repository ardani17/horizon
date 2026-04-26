// ============================================
// Horizon Trader Platform — Help Handler Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpHandler, type ListCommandsFn } from '../../../bot/src/handlers/helpHandler';
import type { CommandHandler } from '../../../bot/src/commands/types';
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
      text: '/help',
    },
    user: createMockUser(),
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockCommand(overrides: Partial<CommandHandler> = {}): CommandHandler {
  return {
    name: '/test',
    description: 'A test command',
    permission: 'member',
    type: 'command',
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- Tests ----

describe('HelpHandler', () => {
  let handler: HelpHandler;
  let listCommands: ListCommandsFn;
  let ctx: BotContext;

  beforeEach(() => {
    listCommands = vi.fn().mockReturnValue([]);
    handler = new HelpHandler(listCommands);
    ctx = createMockContext();
  });

  describe('interface compliance', () => {
    it('should implement CommandHandler interface with correct properties', () => {
      expect(handler.name).toBe('/help');
      expect(handler.type).toBe('command');
      expect(handler.permission).toBe('all');
      expect(handler.description).toBeTruthy();
    });
  });

  describe('empty command list', () => {
    it('should reply with a message when no commands are registered', async () => {
      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Tidak ada command'));
    });
  });

  describe('listing commands', () => {
    it('should list a single registered command with its description', async () => {
      const commands = [
        createMockCommand({ name: '/publish', description: 'Publikasikan pesan' }),
      ];
      vi.mocked(listCommands).mockReturnValue(commands);

      await handler.execute(ctx);

      const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
      expect(replyText).toContain('/publish');
      expect(replyText).toContain('Publikasikan pesan');
    });

    it('should list multiple registered commands', async () => {
      const commands = [
        createMockCommand({ name: '/publish', description: 'Publikasikan pesan' }),
        createMockCommand({ name: '/help', description: 'Tampilkan bantuan' }),
        createMockCommand({ name: '#hashtag', description: 'Publish via hashtag' }),
      ];
      vi.mocked(listCommands).mockReturnValue(commands);

      await handler.execute(ctx);

      const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
      expect(replyText).toContain('/publish');
      expect(replyText).toContain('/help');
      expect(replyText).toContain('#hashtag');
      expect(replyText).toContain('Publikasikan pesan');
      expect(replyText).toContain('Tampilkan bantuan');
      expect(replyText).toContain('Publish via hashtag');
    });

    it('should include hashtag handlers in the list', async () => {
      const commands = [
        createMockCommand({ name: '#hashtag', description: 'Publish via hashtag', type: 'hashtag' }),
        createMockCommand({ name: '/help', description: 'Tampilkan bantuan' }),
      ];
      vi.mocked(listCommands).mockReturnValue(commands);

      await handler.execute(ctx);

      const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
      expect(replyText).toContain('#hashtag');
      expect(replyText).toContain('/help');
    });

    it('should format each command as "name — description"', async () => {
      const commands = [
        createMockCommand({ name: '/publish', description: 'Publikasikan pesan' }),
      ];
      vi.mocked(listCommands).mockReturnValue(commands);

      await handler.execute(ctx);

      const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
      expect(replyText).toContain('/publish — Publikasikan pesan');
    });

    it('should include a header line in the reply', async () => {
      const commands = [
        createMockCommand({ name: '/publish', description: 'Publikasikan pesan' }),
      ];
      vi.mocked(listCommands).mockReturnValue(commands);

      await handler.execute(ctx);

      const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
      expect(replyText).toContain('Daftar command yang tersedia');
    });
  });

  describe('listCommands invocation', () => {
    it('should call the listCommands function exactly once', async () => {
      await handler.execute(ctx);

      expect(listCommands).toHaveBeenCalledTimes(1);
    });
  });

  describe('reply behavior', () => {
    it('should call reply exactly once', async () => {
      const commands = [
        createMockCommand({ name: '/publish', description: 'Publikasikan pesan' }),
        createMockCommand({ name: '/help', description: 'Tampilkan bantuan' }),
      ];
      vi.mocked(listCommands).mockReturnValue(commands);

      await handler.execute(ctx);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
    });
  });
});
