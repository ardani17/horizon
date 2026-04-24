// ============================================
// Horizon Trader Platform — Command Registry Tests
// ============================================

import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry } from '../../../bot/src/commands/registry';
import type { CommandHandler } from '../../../bot/src/commands/types';
import type { TelegramMessage } from '../../../bot/src/middleware/types';

// ---- Test Helpers ----

function createTestMessage(overrides?: Partial<TelegramMessage>): TelegramMessage {
  return {
    message_id: 1,
    from: {
      id: 12345,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    chat: {
      id: -100123,
      type: 'supergroup',
    },
    date: Math.floor(Date.now() / 1000),
    text: 'Hello world',
    ...overrides,
  };
}

function createHandler(overrides?: Partial<CommandHandler>): CommandHandler {
  return {
    name: '/test',
    description: 'Test command',
    permission: 'all',
    type: 'command',
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---- Registration Tests ----

describe('CommandRegistry — register', () => {
  it('should register a command handler', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '/story' });

    registry.register(handler);

    expect(registry.listCommands()).toHaveLength(1);
    expect(registry.listCommands()[0]).toBe(handler);
  });

  it('should register a hashtag handler', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '#jurnal', type: 'hashtag' });

    registry.register(handler);

    expect(registry.listCommands()).toHaveLength(1);
    expect(registry.listCommands()[0]).toBe(handler);
  });

  it('should register multiple handlers', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/story' }));
    registry.register(createHandler({ name: '/cerita' }));
    registry.register(createHandler({ name: '#jurnal', type: 'hashtag' }));

    expect(registry.listCommands()).toHaveLength(3);
  });

  it('should replace handler when registering with the same name', () => {
    const registry = new CommandRegistry();
    const original = createHandler({ name: '/story', description: 'Original' });
    const replacement = createHandler({ name: '/story', description: 'Replacement' });

    registry.register(original);
    registry.register(replacement);

    expect(registry.listCommands()).toHaveLength(1);
    expect(registry.listCommands()[0].description).toBe('Replacement');
  });

  it('should handle case-insensitive registration', () => {
    const registry = new CommandRegistry();
    const handler1 = createHandler({ name: '/Story', description: 'Upper' });
    const handler2 = createHandler({ name: '/story', description: 'Lower' });

    registry.register(handler1);
    registry.register(handler2);

    // Same key after lowercasing, so second replaces first
    expect(registry.listCommands()).toHaveLength(1);
    expect(registry.listCommands()[0].description).toBe('Lower');
  });
});

// ---- Resolve: Slash Commands ----

describe('CommandRegistry — resolve slash commands', () => {
  it('should resolve a registered slash command', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '/story' });
    registry.register(handler);

    const message = createTestMessage({ text: '/story My short story' });
    const resolved = registry.resolve(message);

    expect(resolved).toBe(handler);
  });

  it('should resolve command without arguments', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '/help' });
    registry.register(handler);

    const message = createTestMessage({ text: '/help' });
    expect(registry.resolve(message)).toBe(handler);
  });

  it('should resolve command case-insensitively', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '/story' });
    registry.register(handler);

    const message = createTestMessage({ text: '/Story some text' });
    expect(registry.resolve(message)).toBe(handler);
  });

  it('should strip @botname suffix from commands', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '/story' });
    registry.register(handler);

    const message = createTestMessage({ text: '/story@HorizonBot My story' });
    expect(registry.resolve(message)).toBe(handler);
  });

  it('should return null for unregistered slash command', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/story' }));

    const message = createTestMessage({ text: '/unknown some text' });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should not resolve a hashtag handler as a slash command', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/jurnal', type: 'hashtag' }));

    const message = createTestMessage({ text: '/jurnal some text' });
    expect(registry.resolve(message)).toBeNull();
  });
});

// ---- Resolve: Hashtag Triggers ----

describe('CommandRegistry — resolve hashtag triggers', () => {
  it('should resolve a registered hashtag in message text', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '#jurnal', type: 'hashtag' });
    registry.register(handler);

    const message = createTestMessage({ text: 'My trading journal #jurnal' });
    expect(registry.resolve(message)).toBe(handler);
  });

  it('should resolve hashtag at the beginning of text', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '#trading', type: 'hashtag' });
    registry.register(handler);

    const message = createTestMessage({ text: '#trading Analysis for today' });
    expect(registry.resolve(message)).toBe(handler);
  });

  it('should resolve first matching hashtag when multiple are present', () => {
    const registry = new CommandRegistry();
    const jurnalHandler = createHandler({ name: '#jurnal', type: 'hashtag', description: 'Jurnal' });
    const tradingHandler = createHandler({ name: '#trading', type: 'hashtag', description: 'Trading' });
    registry.register(jurnalHandler);
    registry.register(tradingHandler);

    const message = createTestMessage({ text: 'Entry #jurnal #trading for today' });
    expect(registry.resolve(message)).toBe(jurnalHandler);
  });

  it('should resolve hashtag case-insensitively', () => {
    const registry = new CommandRegistry();
    const handler = createHandler({ name: '#jurnal', type: 'hashtag' });
    registry.register(handler);

    const message = createTestMessage({ text: 'My entry #Jurnal' });
    expect(registry.resolve(message)).toBe(handler);
  });

  it('should return null for unregistered hashtag', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '#jurnal', type: 'hashtag' }));

    const message = createTestMessage({ text: 'Some text #unknown' });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should not resolve a command handler as a hashtag', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '#story', type: 'command' }));

    const message = createTestMessage({ text: 'Text with #story tag' });
    expect(registry.resolve(message)).toBeNull();
  });
});

// ---- Resolve: Edge Cases ----

describe('CommandRegistry — resolve edge cases', () => {
  it('should return null for message with no text', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/story' }));

    const message = createTestMessage({ text: undefined });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should return null for message with empty text', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/story' }));

    const message = createTestMessage({ text: '' });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should return null for message with whitespace-only text', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/story' }));

    const message = createTestMessage({ text: '   ' });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should return null for plain text without commands or hashtags', () => {
    const registry = new CommandRegistry();
    registry.register(createHandler({ name: '/story' }));
    registry.register(createHandler({ name: '#jurnal', type: 'hashtag' }));

    const message = createTestMessage({ text: 'Just a regular message' });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should return null when registry is empty', () => {
    const registry = new CommandRegistry();

    const message = createTestMessage({ text: '/story some text' });
    expect(registry.resolve(message)).toBeNull();
  });

  it('should prefer slash command over hashtag when message starts with /', () => {
    const registry = new CommandRegistry();
    const cmdHandler = createHandler({ name: '/story', type: 'command' });
    const hashHandler = createHandler({ name: '#jurnal', type: 'hashtag' });
    registry.register(cmdHandler);
    registry.register(hashHandler);

    const message = createTestMessage({ text: '/story #jurnal some text' });
    expect(registry.resolve(message)).toBe(cmdHandler);
  });
});

// ---- listCommands ----

describe('CommandRegistry — listCommands', () => {
  it('should return empty array when no handlers registered', () => {
    const registry = new CommandRegistry();
    expect(registry.listCommands()).toEqual([]);
  });

  it('should return all registered handlers', () => {
    const registry = new CommandRegistry();
    const h1 = createHandler({ name: '/story' });
    const h2 = createHandler({ name: '/cerita' });
    const h3 = createHandler({ name: '#jurnal', type: 'hashtag' });

    registry.register(h1);
    registry.register(h2);
    registry.register(h3);

    const commands = registry.listCommands();
    expect(commands).toHaveLength(3);
    expect(commands).toContain(h1);
    expect(commands).toContain(h2);
    expect(commands).toContain(h3);
  });
});
