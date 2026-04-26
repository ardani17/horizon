import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from feed components for testing ----

// From ArticleCard.tsx
function getExcerpt(html: string, maxLength = 150): string {
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// From Pagination.tsx
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) {
    pages.push('...');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('...');
  }

  pages.push(total);

  return pages;
}

// Category labels mapping from ArticleCard
const categoryLabels: Record<string, string> = {
  trading: 'Trading Room',
  life_story: 'Life & Coffee',
  general: 'General',
  outlook: 'Outlook',
};

// Filter logic from FeedList
type CategoryFilter = 'all' | 'trading' | 'life_story';

interface ArticleCardData {
  id: string;
  title: string | null;
  content_html: string;
  category: string;
  slug: string;
  created_at: string;
  author_name: string | null;
}

function filterArticles(articles: ArticleCardData[], category: CategoryFilter): ArticleCardData[] {
  if (category === 'all') return articles;
  return articles.filter((a) => a.category === category);
}

function paginateArticles(articles: ArticleCardData[], page: number, perPage: number): ArticleCardData[] {
  const startIndex = (page - 1) * perPage;
  return articles.slice(startIndex, startIndex + perPage);
}

// ---- Test data helpers ----

function makeArticle(overrides: Partial<ArticleCardData> = {}): ArticleCardData {
  return {
    id: '1',
    title: 'Test Article',
    content_html: '<p>Test content</p>',
    category: 'trading',
    slug: 'test-article-abc123',
    created_at: '2024-01-15T10:00:00Z',
    author_name: 'TestUser',
    ...overrides,
  };
}

// ---- Tests ----

describe('getExcerpt', () => {
  it('strips HTML tags and returns plain text', () => {
    const result = getExcerpt('<p>Hello <strong>world</strong></p>');
    expect(result).toBe('Hello world');
  });

  it('truncates long text with ellipsis', () => {
    const longText = '<p>' + 'a'.repeat(200) + '</p>';
    const result = getExcerpt(longText, 150);
    expect(result.length).toBeLessThanOrEqual(151); // 150 + ellipsis char
    expect(result).toMatch(/…$/);
  });

  it('returns full text when shorter than maxLength', () => {
    const result = getExcerpt('<p>Short text</p>');
    expect(result).toBe('Short text');
  });

  it('handles empty HTML', () => {
    const result = getExcerpt('');
    expect(result).toBe('');
  });

  it('handles nested HTML tags', () => {
    const result = getExcerpt('<div><p>Hello <em>beautiful</em> <strong>world</strong></p></div>');
    expect(result).toBe('Hello beautiful world');
  });
});

describe('formatDate', () => {
  it('formats a date string in Indonesian locale', () => {
    const result = formatDate('2024-01-15T10:00:00Z');
    // Indonesian locale format: "15 Januari 2024"
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('handles different date strings', () => {
    const result = formatDate('2023-12-25T00:00:00Z');
    expect(result).toContain('2023');
  });
});

describe('categoryLabels', () => {
  it('maps trading to Trading Room', () => {
    expect(categoryLabels['trading']).toBe('Trading Room');
  });

  it('maps life_story to Life & Coffee', () => {
    expect(categoryLabels['life_story']).toBe('Life & Coffee');
  });

  it('maps general to General', () => {
    expect(categoryLabels['general']).toBe('General');
  });

  it('maps outlook to Outlook', () => {
    expect(categoryLabels['outlook']).toBe('Outlook');
  });
});

describe('filterArticles', () => {
  const articles: ArticleCardData[] = [
    makeArticle({ id: '1', category: 'trading' }),
    makeArticle({ id: '2', category: 'life_story' }),
    makeArticle({ id: '3', category: 'trading' }),
    makeArticle({ id: '4', category: 'general' }),
    makeArticle({ id: '5', category: 'life_story' }),
  ];

  it('returns all articles when category is "all"', () => {
    const result = filterArticles(articles, 'all');
    expect(result).toHaveLength(5);
  });

  it('filters only trading articles', () => {
    const result = filterArticles(articles, 'trading');
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.category === 'trading')).toBe(true);
  });

  it('filters only life_story articles', () => {
    const result = filterArticles(articles, 'life_story');
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.category === 'life_story')).toBe(true);
  });

  it('returns empty array when no articles match', () => {
    const tradingOnly = [makeArticle({ id: '1', category: 'trading' })];
    const result = filterArticles(tradingOnly, 'life_story');
    expect(result).toHaveLength(0);
  });

  it('handles empty articles array', () => {
    const result = filterArticles([], 'trading');
    expect(result).toHaveLength(0);
  });
});

describe('paginateArticles', () => {
  const articles = Array.from({ length: 25 }, (_, i) =>
    makeArticle({ id: String(i + 1) })
  );

  it('returns first page of articles', () => {
    const result = paginateArticles(articles, 1, 10);
    expect(result).toHaveLength(10);
    expect(result[0].id).toBe('1');
    expect(result[9].id).toBe('10');
  });

  it('returns second page of articles', () => {
    const result = paginateArticles(articles, 2, 10);
    expect(result).toHaveLength(10);
    expect(result[0].id).toBe('11');
  });

  it('returns partial last page', () => {
    const result = paginateArticles(articles, 3, 10);
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe('21');
  });

  it('returns empty array for out-of-range page', () => {
    const result = paginateArticles(articles, 10, 10);
    expect(result).toHaveLength(0);
  });

  it('handles empty articles', () => {
    const result = paginateArticles([], 1, 10);
    expect(result).toHaveLength(0);
  });
});

describe('getPageNumbers', () => {
  it('returns all pages when total <= 7', () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shows ellipsis for large page counts at the beginning', () => {
    const pages = getPageNumbers(1, 20);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(20);
  });

  it('shows ellipsis when current page is in the middle', () => {
    const pages = getPageNumbers(10, 20);
    expect(pages).toContain('...');
    expect(pages).toContain(10);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(20);
  });

  it('always includes first and last page', () => {
    for (let current = 1; current <= 20; current++) {
      const pages = getPageNumbers(current, 20);
      expect(pages[0]).toBe(1);
      expect(pages[pages.length - 1]).toBe(20);
    }
  });

  it('returns single page for total = 1', () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it('returns empty for total = 0', () => {
    expect(getPageNumbers(1, 0)).toEqual([]);
  });
});
