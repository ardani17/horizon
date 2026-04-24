import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { ActorType, TargetType } from '../../../shared/types/index';
import { ActivityLogService, type ActivityLogInput } from '../../../shared/services/activityLog';

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
  } as unknown as Pool;
}

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let mockClient: Pool;

  beforeEach(() => {
    service = new ActivityLogService();
    mockClient = createMockClient();
  });

  it('inserts a log entry with all fields', async () => {
    const entry: ActivityLogInput = {
      actor_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_type: ActorType.ADMIN,
      action: 'article_created',
      target_type: TargetType.ARTICLE,
      target_id: '660e8400-e29b-41d4-a716-446655440001',
      details: { title: 'Test Article', source: 'dashboard' },
      ip_address: '192.168.1.1',
    };

    await service.log(entry, mockClient);

    expect(mockClient.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sql).toContain('INSERT INTO activity_logs');
    expect(params).toEqual([
      '550e8400-e29b-41d4-a716-446655440000',
      'admin',
      'article_created',
      'article',
      '660e8400-e29b-41d4-a716-446655440001',
      JSON.stringify({ title: 'Test Article', source: 'dashboard' }),
      '192.168.1.1',
    ]);
  });

  it('inserts a log entry with nullable fields defaulting to null', async () => {
    const entry: ActivityLogInput = {
      actor_type: ActorType.SYSTEM,
      action: 'scheduled_cleanup',
    };

    await service.log(entry, mockClient);

    const [, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toEqual([
      null,       // actor_id
      'system',   // actor_type
      'scheduled_cleanup', // action
      null,       // target_type
      null,       // target_id
      null,       // details
      null,       // ip_address
    ]);
  });

  it('supports actor_type "member"', async () => {
    const entry: ActivityLogInput = {
      actor_id: 'user-uuid-123',
      actor_type: ActorType.MEMBER,
      action: 'article_created',
      target_type: TargetType.ARTICLE,
      target_id: 'article-uuid-456',
    };

    await service.log(entry, mockClient);

    const [, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[1]).toBe('member');
  });

  it('supports actor_type "external_api"', async () => {
    const entry: ActivityLogInput = {
      actor_type: ActorType.EXTERNAL_API,
      action: 'credit_spend',
      target_type: TargetType.CREDIT,
      target_id: 'txn-uuid-789',
      ip_address: '10.0.0.5',
      details: { api_key_prefix: 'hzn_abc1', endpoint: '/api/credit/spend' },
    };

    await service.log(entry, mockClient);

    const [, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[1]).toBe('external_api');
    expect(params[6]).toBe('10.0.0.5');
  });

  it('serializes details as JSON string', async () => {
    const details = { before: { status: 'published' }, after: { status: 'hidden' } };
    const entry: ActivityLogInput = {
      actor_id: 'admin-uuid',
      actor_type: ActorType.ADMIN,
      action: 'article_status_changed',
      target_type: TargetType.ARTICLE,
      target_id: 'article-uuid',
      details,
    };

    await service.log(entry, mockClient);

    const [, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[5]).toBe(JSON.stringify(details));
  });

  it('sets details to null when not provided', async () => {
    const entry: ActivityLogInput = {
      actor_type: ActorType.ADMIN,
      action: 'admin_login',
    };

    await service.log(entry, mockClient);

    const [, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[5]).toBeNull();
  });

  it('sets details to null when explicitly null', async () => {
    const entry: ActivityLogInput = {
      actor_type: ActorType.SYSTEM,
      action: 'heartbeat',
      details: null,
    };

    await service.log(entry, mockClient);

    const [, params] = (mockClient.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[5]).toBeNull();
  });

  it('supports all target types', async () => {
    const targetTypes = [
      TargetType.ARTICLE,
      TargetType.MEDIA,
      TargetType.USER,
      TargetType.CREDIT,
      TargetType.SETTING,
      TargetType.API_KEY,
    ];

    for (const targetType of targetTypes) {
      const client = createMockClient();
      await service.log(
        { actor_type: ActorType.ADMIN, action: 'test', target_type: targetType },
        client,
      );

      const [, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params[3]).toBe(targetType);
    }
  });

  it('does not expose update or delete methods', () => {
    // The service should be insert-only (immutable logs)
    expect(service).not.toHaveProperty('update');
    expect(service).not.toHaveProperty('delete');
    expect(service).not.toHaveProperty('remove');
    expect(service).not.toHaveProperty('edit');
  });

  it('propagates database errors', async () => {
    const failingClient = {
      query: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Pool;

    const entry: ActivityLogInput = {
      actor_type: ActorType.SYSTEM,
      action: 'test_action',
    };

    await expect(service.log(entry, failingClient)).rejects.toThrow('connection refused');
  });
});
