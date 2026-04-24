import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { CreditService } from '../../../shared/services/creditService';

/**
 * Creates a mock database client that tracks all queries.
 * By default, the first query (credit_settings lookup) returns an active reward.
 */
function createMockClient(settingsRow: { credit_reward: number; is_active: boolean } | null = {
  credit_reward: 10,
  is_active: true,
}) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    // First SELECT query returns credit_settings row
    if (sql.includes('SELECT credit_reward')) {
      return Promise.resolve({
        rows: settingsRow ? [settingsRow] : [],
        rowCount: settingsRow ? 1 : 0,
      });
    }
    // INSERT and UPDATE queries return affected row count
    return Promise.resolve({ rows: [], rowCount: 1 });
  });

  return {
    query: queryFn,
  } as unknown as Pool;
}

describe('CreditService', () => {
  let service: CreditService;

  beforeEach(() => {
    service = new CreditService();
  });

  describe('awardCreditForArticle', () => {
    it('awards credit when category reward is active', async () => {
      const client = createMockClient({ credit_reward: 10, is_active: true });

      const result = await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'trading',
        client,
      });

      expect(result).toEqual({ awarded: true, amount: 10 });

      // Verify all 4 queries were executed: SELECT settings, INSERT transaction, UPDATE balance, INSERT log
      expect(client.query).toHaveBeenCalledTimes(4);

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;

      // Query 1: Read credit_settings
      expect(calls[0][0]).toContain('SELECT credit_reward');
      expect(calls[0][1]).toEqual(['trading']);

      // Query 2: Insert credit_transaction
      expect(calls[1][0]).toContain('INSERT INTO credit_transactions');
      expect(calls[1][1]).toEqual(['user-123', 10, 'earned', 'article_trading', 'article-456', null]);

      // Query 3: Update user balance
      expect(calls[2][0]).toContain('UPDATE users SET credit_balance');
      expect(calls[2][1]).toEqual([10, 'user-123']);

      // Query 4: Insert activity_log
      expect(calls[3][0]).toContain('INSERT INTO activity_logs');
      expect(calls[3][1][0]).toBe('user-123');
      expect(calls[3][1][2]).toBe('credit_earned');
    });

    it('skips credit award when category reward is inactive', async () => {
      const client = createMockClient({ credit_reward: 10, is_active: false });

      const result = await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'trading',
        client,
      });

      expect(result).toEqual({ awarded: false, amount: 0 });

      // Only the SELECT query should have been executed
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('skips credit award when no settings found for category', async () => {
      const client = createMockClient(null);

      const result = await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'unknown_category',
        client,
      });

      expect(result).toEqual({ awarded: false, amount: 0 });
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('skips credit award when reward amount is zero', async () => {
      const client = createMockClient({ credit_reward: 0, is_active: true });

      const result = await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'general',
        client,
      });

      expect(result).toEqual({ awarded: false, amount: 0 });
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('maps trading category to article_trading source type', async () => {
      const client = createMockClient({ credit_reward: 10, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'trading',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      // credit_transaction insert: source_type is the 4th param
      expect(calls[1][1][3]).toBe('article_trading');
    });

    it('maps life_story category to article_life_story source type', async () => {
      const client = createMockClient({ credit_reward: 5, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'life_story',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[1][1][3]).toBe('article_life_story');
    });

    it('maps general category to article_general source type', async () => {
      const client = createMockClient({ credit_reward: 3, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'general',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[1][1][3]).toBe('article_general');
    });

    it('falls back to article_general for unknown categories', async () => {
      const client = createMockClient({ credit_reward: 7, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'some_new_category',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[1][1][3]).toBe('article_general');
    });

    it('uses the exact reward amount from credit_settings', async () => {
      const client = createMockClient({ credit_reward: 42, is_active: true });

      const result = await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'trading',
        client,
      });

      expect(result.amount).toBe(42);

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      // credit_transaction amount
      expect(calls[1][1][1]).toBe(42);
      // user balance update amount
      expect(calls[2][1][0]).toBe(42);
    });

    it('logs activity with correct details JSON', async () => {
      const client = createMockClient({ credit_reward: 10, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'trading',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      const logParams = calls[3][1];

      expect(logParams[0]).toBe('user-123');       // actor_id
      expect(logParams[1]).toBe('member');          // actor_type
      expect(logParams[2]).toBe('credit_earned');   // action
      expect(logParams[3]).toBe('credit');          // target_type
      expect(logParams[4]).toBe('article-456');     // target_id

      const details = JSON.parse(logParams[5]);
      expect(details).toEqual({
        amount: 10,
        category: 'trading',
        source_type: 'article_trading',
      });
    });

    it('propagates database errors', async () => {
      const client = {
        query: vi.fn().mockRejectedValue(new Error('connection refused')),
      } as unknown as Pool;

      await expect(
        service.awardCreditForArticle({
          userId: 'user-123',
          articleId: 'article-456',
          category: 'trading',
          client,
        }),
      ).rejects.toThrow('connection refused');
    });

    it('sets transaction_type to earned', async () => {
      const client = createMockClient({ credit_reward: 5, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'life_story',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      // credit_transaction insert: transaction_type is the 3rd param
      expect(calls[1][1][2]).toBe('earned');
    });

    it('sets description to null for automatic awards', async () => {
      const client = createMockClient({ credit_reward: 5, is_active: true });

      await service.awardCreditForArticle({
        userId: 'user-123',
        articleId: 'article-456',
        category: 'life_story',
        client,
      });

      const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls;
      // credit_transaction insert: description is the 6th param
      expect(calls[1][1][5]).toBeNull();
    });
  });
});
