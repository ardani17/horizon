import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApiRouter, CommandStats } from '../../../bot/src/routes/api';
import { CommandRegistry } from '../../../bot/src/commands/registry';
import type { CommandHandler } from '../../../bot/src/commands/types';

/**
 * Unit tests for bot REST API endpoints.
 *
 * Uses dependency injection to test the router in isolation
 * without needing a real Telegram bot or database.
 *
 * Validates: Requirements 15.4, 15.5
 */

function createTestApp(overrides: Partial<Parameters<typeof createApiRouter>[0]> = {}) {
  const registry = new CommandRegistry();
  const stats = new CommandStats();
  const sendGroupMessage = vi.fn().mockResolvedValue(undefined);

  const deps = { registry, stats, sendGroupMessage, ...overrides };
  const app = express();
  app.use(express.json());
  app.use('/api/bot', createApiRouter(deps));

  return { app, registry, stats, sendGroupMessage };
}

function makeHandler(partial: Partial<CommandHandler> & { name: string }): CommandHandler {
  return {
    description: `${partial.name} handler`,
    permission: 'member',
    type: 'command',
    execute: vi.fn().mockResolvedValue(undefined),
    ...partial,
  };
}

// ---- CommandStats unit tests ----

describe('CommandStats', () => {
  let stats: CommandStats;

  beforeEach(() => {
    stats = new CommandStats();
  });

  it('starts with zero counts', () => {
    expect(stats.getAll()).toEqual({});
    expect(stats.total()).toBe(0);
  });

  it('increments a command count', () => {
    stats.increment('/publish');
    expect(stats.get('/publish')).toBe(1);
    stats.increment('/publish');
    expect(stats.get('/publish')).toBe(2);
  });

  it('tracks multiple commands independently', () => {
    stats.increment('/publish');
    stats.increment('/help');
    stats.increment('/publish');

    expect(stats.get('/publish')).toBe(2);
    expect(stats.get('/help')).toBe(1);
    expect(stats.total()).toBe(3);
  });

  it('returns 0 for unknown commands', () => {
    expect(stats.get('/unknown')).toBe(0);
  });
});

// ---- GET /api/bot/commands ----

describe('GET /api/bot/commands', () => {
  it('returns empty list when no commands registered', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/bot/commands');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.commands).toEqual([]);
  });

  it('returns registered commands with metadata', async () => {
    const { app, registry } = createTestApp();

    registry.register(makeHandler({
      name: '/publish',
      description: 'Publish a message as article',
      type: 'command',
      permission: 'member',
    }));
    registry.register(makeHandler({
      name: '#trading',
      description: 'Trading journal via hashtag',
      type: 'hashtag',
      permission: 'member',
    }));

    const res = await request(app).get('/api/bot/commands');

    expect(res.status).toBe(200);
    expect(res.body.data.commands).toHaveLength(2);

    const publishCmd = res.body.data.commands.find((c: any) => c.name === '/publish');
    expect(publishCmd).toEqual({
      name: '/publish',
      description: 'Publish a message as article',
      type: 'command',
      permission: 'member',
    });

    const tradingCmd = res.body.data.commands.find((c: any) => c.name === '#trading');
    expect(tradingCmd).toEqual({
      name: '#trading',
      description: 'Trading journal via hashtag',
      type: 'hashtag',
      permission: 'member',
    });
  });

  it('does not expose the execute function', async () => {
    const { app, registry } = createTestApp();
    registry.register(makeHandler({ name: '/help' }));

    const res = await request(app).get('/api/bot/commands');
    const cmd = res.body.data.commands[0];

    expect(cmd.execute).toBeUndefined();
  });
});

// ---- GET /api/bot/stats ----

describe('GET /api/bot/stats', () => {
  it('returns empty stats initially', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/bot/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.commandUsage).toEqual({});
    expect(res.body.data.totalInvocations).toBe(0);
  });

  it('returns accumulated stats', async () => {
    const { app, stats } = createTestApp();
    stats.increment('/publish');
    stats.increment('/publish');
    stats.increment('/help');

    const res = await request(app).get('/api/bot/stats');

    expect(res.body.data.commandUsage).toEqual({
      '/publish': 2,
      '/help': 1,
    });
    expect(res.body.data.totalInvocations).toBe(3);
  });
});

// ---- POST /api/bot/notify ----

describe('POST /api/bot/notify', () => {
  it('sends a notification and returns success', async () => {
    const { app, sendGroupMessage } = createTestApp();

    const res = await request(app)
      .post('/api/bot/notify')
      .send({ message: 'Hello group!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sent).toBe(true);
    expect(sendGroupMessage).toHaveBeenCalledWith('Hello group!');
  });

  it('trims whitespace from message', async () => {
    const { app, sendGroupMessage } = createTestApp();

    await request(app)
      .post('/api/bot/notify')
      .send({ message: '  Hello!  ' });

    expect(sendGroupMessage).toHaveBeenCalledWith('Hello!');
  });

  it('rejects missing message field', async () => {
    const { app, sendGroupMessage } = createTestApp();

    const res = await request(app)
      .post('/api/bot/notify')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.error_code).toBe('VALIDATION_ERROR');
    expect(sendGroupMessage).not.toHaveBeenCalled();
  });

  it('rejects empty string message', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/bot/notify')
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects whitespace-only message', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/bot/notify')
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects non-string message', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/bot/notify')
      .send({ message: 123 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when sendGroupMessage fails', async () => {
    const sendGroupMessage = vi.fn().mockRejectedValue(new Error('Telegram API error'));
    const { app } = createTestApp({ sendGroupMessage });

    const res = await request(app)
      .post('/api/bot/notify')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.error_code).toBe('INTERNAL_ERROR');
  });
});
