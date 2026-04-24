import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from LikeButton for testing ----

/**
 * Replicate the fingerprint hash function (djb2) from LikeButton.tsx
 * to test it in isolation without DOM dependencies.
 */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}

function buildFingerprintInput(
  userAgent: string,
  screenWidth: number,
  screenHeight: number,
  timezone: string
): string {
  return [userAgent, `${screenWidth}x${screenHeight}`, timezone].join('|');
}

// ---- Tests ----

describe('fingerprint hash (djb2)', () => {
  it('produces a non-empty string', () => {
    const result = djb2Hash('test input');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('is deterministic — same input produces same output', () => {
    const input = 'Mozilla/5.0|1920x1080|America/New_York';
    expect(djb2Hash(input)).toBe(djb2Hash(input));
  });

  it('produces different hashes for different inputs', () => {
    const a = djb2Hash('Mozilla/5.0|1920x1080|America/New_York');
    const b = djb2Hash('Mozilla/5.0|1366x768|Europe/London');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const result = djb2Hash('');
    expect(result).toBeTruthy();
  });

  it('returns a base-36 encoded string', () => {
    const result = djb2Hash('some input');
    // base-36 characters: 0-9, a-z, and possibly a leading minus sign
    expect(result).toMatch(/^-?[0-9a-z]+$/);
  });
});

describe('fingerprint input construction', () => {
  it('joins user agent, screen resolution, and timezone with pipe', () => {
    const result = buildFingerprintInput(
      'Mozilla/5.0',
      1920,
      1080,
      'Asia/Jakarta'
    );
    expect(result).toBe('Mozilla/5.0|1920x1080|Asia/Jakarta');
  });

  it('handles different screen sizes', () => {
    const a = buildFingerprintInput('UA', 1920, 1080, 'UTC');
    const b = buildFingerprintInput('UA', 1366, 768, 'UTC');
    expect(a).not.toBe(b);
  });

  it('handles different timezones', () => {
    const a = buildFingerprintInput('UA', 1920, 1080, 'Asia/Jakarta');
    const b = buildFingerprintInput('UA', 1920, 1080, 'America/New_York');
    expect(a).not.toBe(b);
  });
});

describe('like toggle logic', () => {
  // Simulate the toggle logic from the API route
  function toggleLike(
    existingLikes: Array<{ article_id: string; fingerprint: string }>,
    articleId: string,
    fingerprint: string
  ): { liked: boolean; likes: Array<{ article_id: string; fingerprint: string }> } {
    const existingIndex = existingLikes.findIndex(
      (l) => l.article_id === articleId && l.fingerprint === fingerprint
    );

    if (existingIndex !== -1) {
      // Unlike
      const likes = existingLikes.filter((_, i) => i !== existingIndex);
      return { liked: false, likes };
    } else {
      // Like
      const likes = [...existingLikes, { article_id: articleId, fingerprint }];
      return { liked: true, likes };
    }
  }

  function getLikeCount(
    likes: Array<{ article_id: string; fingerprint: string }>,
    articleId: string
  ): number {
    return likes.filter((l) => l.article_id === articleId).length;
  }

  it('adds a like when none exists', () => {
    const result = toggleLike([], 'article-1', 'fp-1');
    expect(result.liked).toBe(true);
    expect(result.likes).toHaveLength(1);
  });

  it('removes a like when one already exists (toggle off)', () => {
    const existing = [{ article_id: 'article-1', fingerprint: 'fp-1' }];
    const result = toggleLike(existing, 'article-1', 'fp-1');
    expect(result.liked).toBe(false);
    expect(result.likes).toHaveLength(0);
  });

  it('allows different fingerprints to like the same article', () => {
    let likes: Array<{ article_id: string; fingerprint: string }> = [];
    const r1 = toggleLike(likes, 'article-1', 'fp-1');
    likes = r1.likes;
    const r2 = toggleLike(likes, 'article-1', 'fp-2');
    likes = r2.likes;

    expect(r1.liked).toBe(true);
    expect(r2.liked).toBe(true);
    expect(getLikeCount(likes, 'article-1')).toBe(2);
  });

  it('allows same fingerprint to like different articles', () => {
    let likes: Array<{ article_id: string; fingerprint: string }> = [];
    const r1 = toggleLike(likes, 'article-1', 'fp-1');
    likes = r1.likes;
    const r2 = toggleLike(likes, 'article-2', 'fp-1');
    likes = r2.likes;

    expect(r1.liked).toBe(true);
    expect(r2.liked).toBe(true);
    expect(getLikeCount(likes, 'article-1')).toBe(1);
    expect(getLikeCount(likes, 'article-2')).toBe(1);
  });

  it('toggling twice returns to original state', () => {
    let likes: Array<{ article_id: string; fingerprint: string }> = [];
    const r1 = toggleLike(likes, 'article-1', 'fp-1');
    likes = r1.likes;
    const r2 = toggleLike(likes, 'article-1', 'fp-1');
    likes = r2.likes;

    expect(r1.liked).toBe(true);
    expect(r2.liked).toBe(false);
    expect(getLikeCount(likes, 'article-1')).toBe(0);
  });

  it('does not affect other articles when toggling', () => {
    const likes = [
      { article_id: 'article-1', fingerprint: 'fp-1' },
      { article_id: 'article-2', fingerprint: 'fp-1' },
    ];
    const result = toggleLike(likes, 'article-1', 'fp-1');

    expect(result.liked).toBe(false);
    expect(getLikeCount(result.likes, 'article-1')).toBe(0);
    expect(getLikeCount(result.likes, 'article-2')).toBe(1);
  });

  it('counts likes correctly for a specific article', () => {
    const likes = [
      { article_id: 'article-1', fingerprint: 'fp-1' },
      { article_id: 'article-1', fingerprint: 'fp-2' },
      { article_id: 'article-1', fingerprint: 'fp-3' },
      { article_id: 'article-2', fingerprint: 'fp-1' },
    ];
    expect(getLikeCount(likes, 'article-1')).toBe(3);
    expect(getLikeCount(likes, 'article-2')).toBe(1);
  });
});

describe('localStorage like tracking', () => {
  // Simulate the localStorage tracking logic from LikeButton
  function updateLikedArticles(
    current: string[],
    articleId: string,
    liked: boolean
  ): string[] {
    const result = [...current];
    if (liked) {
      if (!result.includes(articleId)) {
        result.push(articleId);
      }
    } else {
      const idx = result.indexOf(articleId);
      if (idx !== -1) result.splice(idx, 1);
    }
    return result;
  }

  it('adds article ID when liked', () => {
    const result = updateLikedArticles([], 'article-1', true);
    expect(result).toEqual(['article-1']);
  });

  it('removes article ID when unliked', () => {
    const result = updateLikedArticles(['article-1'], 'article-1', false);
    expect(result).toEqual([]);
  });

  it('does not duplicate article ID on repeated likes', () => {
    let list = updateLikedArticles([], 'article-1', true);
    list = updateLikedArticles(list, 'article-1', true);
    expect(list).toEqual(['article-1']);
  });

  it('preserves other articles when removing one', () => {
    const result = updateLikedArticles(
      ['article-1', 'article-2', 'article-3'],
      'article-2',
      false
    );
    expect(result).toEqual(['article-1', 'article-3']);
  });
});
