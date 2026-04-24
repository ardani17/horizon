import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkGeneralLimit,
  checkSpendLimit,
  clearAllBuckets,
} from '../../../frontend/src/lib/rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    clearAllBuckets();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkGeneralLimit', () => {
    it('allows the first request', () => {
      const result = checkGeneralLimit('key-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('tracks remaining count correctly', () => {
      for (let i = 0; i < 5; i++) {
        checkGeneralLimit('key-1');
      }
      const result = checkGeneralLimit('key-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(94); // 100 - 6
    });

    it('blocks after 100 requests in the same window', () => {
      for (let i = 0; i < 100; i++) {
        const r = checkGeneralLimit('key-1');
        expect(r.allowed).toBe(true);
      }
      const blocked = checkGeneralLimit('key-1');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('resets after the window expires', () => {
      for (let i = 0; i < 100; i++) {
        checkGeneralLimit('key-1');
      }
      // Advance time past the 60-second window
      vi.advanceTimersByTime(61_000);

      const result = checkGeneralLimit('key-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('tracks different API keys independently', () => {
      for (let i = 0; i < 100; i++) {
        checkGeneralLimit('key-1');
      }
      // key-1 is exhausted
      expect(checkGeneralLimit('key-1').allowed).toBe(false);
      // key-2 should still be allowed
      const result = checkGeneralLimit('key-2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('provides a valid resetAt timestamp', () => {
      const result = checkGeneralLimit('key-1');
      expect(result.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('checkSpendLimit', () => {
    it('allows the first spend request', () => {
      const result = checkSpendLimit('key-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('blocks after 10 spend requests in the same window', () => {
      for (let i = 0; i < 10; i++) {
        const r = checkSpendLimit('key-1');
        expect(r.allowed).toBe(true);
      }
      const blocked = checkSpendLimit('key-1');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('resets after the window expires', () => {
      for (let i = 0; i < 10; i++) {
        checkSpendLimit('key-1');
      }
      vi.advanceTimersByTime(61_000);

      const result = checkSpendLimit('key-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('tracks different API keys independently', () => {
      for (let i = 0; i < 10; i++) {
        checkSpendLimit('key-1');
      }
      expect(checkSpendLimit('key-1').allowed).toBe(false);
      expect(checkSpendLimit('key-2').allowed).toBe(true);
    });
  });

  describe('clearAllBuckets', () => {
    it('resets all rate limit state', () => {
      for (let i = 0; i < 100; i++) {
        checkGeneralLimit('key-1');
      }
      for (let i = 0; i < 10; i++) {
        checkSpendLimit('key-1');
      }
      expect(checkGeneralLimit('key-1').allowed).toBe(false);
      expect(checkSpendLimit('key-1').allowed).toBe(false);

      clearAllBuckets();

      expect(checkGeneralLimit('key-1').allowed).toBe(true);
      expect(checkSpendLimit('key-1').allowed).toBe(true);
    });
  });
});
