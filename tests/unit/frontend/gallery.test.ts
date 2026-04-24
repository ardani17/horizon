import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from gallery components for testing ----

// Media type labels from GalleryItem.tsx
const mediaTypeLabels: Record<string, string> = {
  image: 'Foto',
  video: 'Video',
};

// GalleryMediaItem type
interface GalleryMediaItem {
  id: string;
  file_url: string;
  media_type: string;
  article_title: string | null;
  article_slug: string | null;
  created_at: string;
}

// Infinite scroll pagination logic from GalleryGrid.tsx
function computeHasMore(loadedCount: number, totalCount: number): boolean {
  return loadedCount < totalCount;
}

// API route offset/limit clamping logic from route.ts
function clampOffset(raw: number): number {
  return Math.max(0, raw || 0);
}

function clampLimit(raw: number, maxLimit = 50, defaultLimit = 18): number {
  return Math.min(maxLimit, Math.max(1, raw || defaultLimit));
}

// Sorting verification: items should be in reverse chronological order
function isReverseChronological(items: GalleryMediaItem[]): boolean {
  for (let i = 0; i < items.length - 1; i++) {
    const current = new Date(items[i].created_at).getTime();
    const next = new Date(items[i + 1].created_at).getTime();
    if (current < next) return false;
  }
  return true;
}

// ---- Test data helpers ----

function makeMediaItem(overrides: Partial<GalleryMediaItem> = {}): GalleryMediaItem {
  return {
    id: '1',
    file_url: 'https://example.r2.dev/media/test.jpg',
    media_type: 'image',
    article_title: 'Test Article',
    article_slug: 'test-article-abc123',
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

// ---- Tests ----

describe('mediaTypeLabels', () => {
  it('maps image to Foto', () => {
    expect(mediaTypeLabels['image']).toBe('Foto');
  });

  it('maps video to Video', () => {
    expect(mediaTypeLabels['video']).toBe('Video');
  });

  it('returns undefined for unknown types', () => {
    expect(mediaTypeLabels['audio']).toBeUndefined();
  });
});

describe('computeHasMore', () => {
  it('returns true when loaded count is less than total', () => {
    expect(computeHasMore(18, 50)).toBe(true);
  });

  it('returns false when loaded count equals total', () => {
    expect(computeHasMore(50, 50)).toBe(false);
  });

  it('returns false when loaded count exceeds total', () => {
    expect(computeHasMore(60, 50)).toBe(false);
  });

  it('returns false when both are zero', () => {
    expect(computeHasMore(0, 0)).toBe(false);
  });

  it('returns true when loaded is zero but total is positive', () => {
    expect(computeHasMore(0, 10)).toBe(true);
  });
});

describe('clampOffset', () => {
  it('returns 0 for negative values', () => {
    expect(clampOffset(-5)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(clampOffset(NaN)).toBe(0);
  });

  it('returns the value for positive numbers', () => {
    expect(clampOffset(18)).toBe(18);
  });

  it('returns 0 for zero', () => {
    expect(clampOffset(0)).toBe(0);
  });
});

describe('clampLimit', () => {
  it('returns default for NaN', () => {
    expect(clampLimit(NaN)).toBe(18);
  });

  it('clamps to max limit', () => {
    expect(clampLimit(100)).toBe(50);
  });

  it('clamps to minimum of 1', () => {
    expect(clampLimit(0)).toBe(18);
    expect(clampLimit(-5)).toBe(1);
  });

  it('returns the value when within range', () => {
    expect(clampLimit(25)).toBe(25);
  });

  it('returns 1 for very small negative values', () => {
    expect(clampLimit(-100)).toBe(1);
  });
});

describe('isReverseChronological', () => {
  it('returns true for items in reverse chronological order', () => {
    const items = [
      makeMediaItem({ created_at: '2024-03-01T00:00:00Z' }),
      makeMediaItem({ created_at: '2024-02-01T00:00:00Z' }),
      makeMediaItem({ created_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(isReverseChronological(items)).toBe(true);
  });

  it('returns false for items in chronological order', () => {
    const items = [
      makeMediaItem({ created_at: '2024-01-01T00:00:00Z' }),
      makeMediaItem({ created_at: '2024-02-01T00:00:00Z' }),
      makeMediaItem({ created_at: '2024-03-01T00:00:00Z' }),
    ];
    expect(isReverseChronological(items)).toBe(false);
  });

  it('returns true for a single item', () => {
    const items = [makeMediaItem()];
    expect(isReverseChronological(items)).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(isReverseChronological([])).toBe(true);
  });

  it('returns true for items with same timestamp', () => {
    const items = [
      makeMediaItem({ created_at: '2024-01-15T10:00:00Z' }),
      makeMediaItem({ created_at: '2024-01-15T10:00:00Z' }),
    ];
    expect(isReverseChronological(items)).toBe(true);
  });
});

describe('GalleryMediaItem structure', () => {
  it('creates a valid media item with all fields', () => {
    const item = makeMediaItem();
    expect(item.id).toBe('1');
    expect(item.file_url).toContain('r2.dev');
    expect(item.media_type).toBe('image');
    expect(item.article_title).toBe('Test Article');
    expect(item.article_slug).toBe('test-article-abc123');
    expect(item.created_at).toBe('2024-01-15T10:00:00Z');
  });

  it('allows null article_title and article_slug', () => {
    const item = makeMediaItem({ article_title: null, article_slug: null });
    expect(item.article_title).toBeNull();
    expect(item.article_slug).toBeNull();
  });

  it('supports video media type', () => {
    const item = makeMediaItem({ media_type: 'video' });
    expect(item.media_type).toBe('video');
  });
});
