import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from article components for testing ----

// From ArticleMeta.tsx
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

// ---- Tests ----

describe('estimateReadTime', () => {
  it('returns 1 minute for short content', () => {
    const html = '<p>Hello world</p>';
    expect(estimateReadTime(html)).toBe(1);
  });

  it('returns 1 minute for empty content', () => {
    expect(estimateReadTime('')).toBe(1);
  });

  it('returns 1 minute for content with only HTML tags', () => {
    expect(estimateReadTime('<p></p><br/>')).toBe(1);
  });

  it('calculates read time for longer content (200 words = 1 min)', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const html = `<p>${words}</p>`;
    expect(estimateReadTime(html)).toBe(1);
  });

  it('calculates read time for 400 words as 2 minutes', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const html = `<p>${words}</p>`;
    expect(estimateReadTime(html)).toBe(2);
  });

  it('calculates read time for 500 words as 3 minutes', () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const html = `<p>${words}</p>`;
    expect(estimateReadTime(html)).toBe(3);
  });

  it('strips HTML tags before counting words', () => {
    const html = '<p>Hello <strong>beautiful</strong> <em>world</em></p>';
    // 3 words → 1 minute
    expect(estimateReadTime(html)).toBe(1);
  });

  it('handles content with multiple paragraphs', () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`);
    const half = Math.floor(words.length / 2);
    const html = `<p>${words.slice(0, half).join(' ')}</p><p>${words.slice(half).join(' ')}</p>`;
    expect(estimateReadTime(html)).toBe(2);
  });
});

describe('formatDate (article)', () => {
  it('formats a date string in Indonesian locale', () => {
    const result = formatDate('2024-01-15T10:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('handles different date strings', () => {
    const result = formatDate('2023-12-25T00:00:00Z');
    expect(result).toContain('2023');
  });
});

describe('content type layout differentiation', () => {
  // Test the logic that determines layout based on content_type
  function getLayoutClass(contentType: string): string {
    return contentType === 'long' ? 'longLayout' : 'shortLayout';
  }

  function getTitleClass(contentType: string): string {
    return contentType === 'long' ? 'longTitle' : '';
  }

  it('returns longLayout for long content type', () => {
    expect(getLayoutClass('long')).toBe('longLayout');
  });

  it('returns shortLayout for short content type', () => {
    expect(getLayoutClass('short')).toBe('shortLayout');
  });

  it('returns shortLayout for unknown content type', () => {
    expect(getLayoutClass('unknown')).toBe('shortLayout');
  });

  it('returns longTitle class for long content type', () => {
    expect(getTitleClass('long')).toBe('longTitle');
  });

  it('returns empty string for short content type title', () => {
    expect(getTitleClass('short')).toBe('');
  });
});

describe('article display title fallback', () => {
  function getDisplayTitle(title: string | null, contentHtml: string): string {
    return title || contentHtml.replace(/<[^>]*>/g, '').trim().slice(0, 80);
  }

  it('uses title when available', () => {
    expect(getDisplayTitle('My Article', '<p>Content</p>')).toBe('My Article');
  });

  it('falls back to content excerpt when title is null', () => {
    expect(getDisplayTitle(null, '<p>This is the content</p>')).toBe('This is the content');
  });

  it('truncates fallback title to 80 characters', () => {
    const longContent = '<p>' + 'a'.repeat(200) + '</p>';
    const result = getDisplayTitle(null, longContent);
    expect(result.length).toBe(80);
  });

  it('handles empty content with null title', () => {
    expect(getDisplayTitle(null, '')).toBe('');
  });
});

describe('article metadata description generation', () => {
  function generateDescription(contentHtml: string): string {
    const plainText = contentHtml.replace(/<[^>]*>/g, '').trim();
    if (plainText.length > 160) {
      return plainText.slice(0, 160).trimEnd() + '…';
    }
    return plainText;
  }

  it('returns full text for short content', () => {
    expect(generateDescription('<p>Short text</p>')).toBe('Short text');
  });

  it('truncates long content to 160 chars with ellipsis', () => {
    const longContent = '<p>' + 'a'.repeat(200) + '</p>';
    const result = generateDescription(longContent);
    expect(result.length).toBeLessThanOrEqual(161);
    expect(result).toMatch(/…$/);
  });

  it('strips HTML tags', () => {
    expect(generateDescription('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });
});
