import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from Outlook components for testing ----

// From OutlookCard.tsx
function getExcerpt(html: string, maxLength = 200): string {
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

// From ArticleMeta.tsx (reused in OutlookCard)
function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---- Test data helpers ----

interface OutlookCardData {
  id: string;
  title: string | null;
  content_html: string;
  slug: string;
  created_at: string;
  author_name: string | null;
  cover_image: string | null;
}

function makeOutlookArticle(overrides: Partial<OutlookCardData> = {}): OutlookCardData {
  return {
    id: '1',
    title: 'Market Outlook Q1 2024',
    content_html: '<p>Analisa mendalam tentang pergerakan market di kuartal pertama 2024.</p>',
    slug: 'market-outlook-q1-2024-abc123',
    created_at: '2024-01-15T10:00:00Z',
    author_name: 'TraderPro',
    cover_image: 'https://r2.example.com/chart.jpg',
    ...overrides,
  };
}

// ---- Tests ----

describe('OutlookCard getExcerpt', () => {
  it('strips HTML tags and returns plain text', () => {
    const result = getExcerpt('<p>Analisa <strong>market</strong> mendalam</p>');
    expect(result).toBe('Analisa market mendalam');
  });

  it('truncates long text at 200 chars with ellipsis', () => {
    const longText = '<p>' + 'kata '.repeat(100) + '</p>';
    const result = getExcerpt(longText, 200);
    expect(result.length).toBeLessThanOrEqual(201);
    expect(result).toMatch(/…$/);
  });

  it('returns full text when shorter than maxLength', () => {
    const result = getExcerpt('<p>Short outlook</p>');
    expect(result).toBe('Short outlook');
  });

  it('handles empty HTML', () => {
    const result = getExcerpt('');
    expect(result).toBe('');
  });
});

describe('estimateReadTime', () => {
  it('returns 1 minute for short content', () => {
    const result = estimateReadTime('<p>Hello world</p>');
    expect(result).toBe(1);
  });

  it('estimates correctly for longer content', () => {
    // 400 words should be ~2 minutes
    const words = Array(400).fill('word').join(' ');
    const result = estimateReadTime(`<p>${words}</p>`);
    expect(result).toBe(2);
  });

  it('returns at least 1 minute for empty content', () => {
    const result = estimateReadTime('');
    expect(result).toBe(1);
  });
});

describe('formatDate for Outlook', () => {
  it('formats date in Indonesian locale', () => {
    const result = formatDate('2024-01-15T10:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });
});

describe('OutlookCardData structure', () => {
  it('creates a valid outlook article with all fields', () => {
    const article = makeOutlookArticle();
    expect(article.id).toBe('1');
    expect(article.title).toBe('Market Outlook Q1 2024');
    expect(article.cover_image).toBe('https://r2.example.com/chart.jpg');
    expect(article.slug).toContain('outlook');
  });

  it('handles article without cover image', () => {
    const article = makeOutlookArticle({ cover_image: null });
    expect(article.cover_image).toBeNull();
  });

  it('handles article without title', () => {
    const article = makeOutlookArticle({ title: null });
    expect(article.title).toBeNull();
    // Display title should fall back to excerpt
    const excerpt = getExcerpt(article.content_html);
    const displayTitle = article.title || excerpt.slice(0, 80);
    expect(displayTitle.length).toBeGreaterThan(0);
  });

  it('handles article without author', () => {
    const article = makeOutlookArticle({ author_name: null });
    expect(article.author_name).toBeNull();
  });
});

describe('Outlook listing sort order', () => {
  it('articles should be sortable in reverse chronological order', () => {
    const articles = [
      makeOutlookArticle({ id: '1', created_at: '2024-01-10T10:00:00Z' }),
      makeOutlookArticle({ id: '2', created_at: '2024-01-15T10:00:00Z' }),
      makeOutlookArticle({ id: '3', created_at: '2024-01-12T10:00:00Z' }),
    ];

    const sorted = [...articles].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('3');
    expect(sorted[2].id).toBe('1');
  });
});
