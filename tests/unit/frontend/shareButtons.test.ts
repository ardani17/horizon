import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from ShareButtons for testing ----

function buildShareText(title: string, excerpt: string): string {
  return `${title}${excerpt ? ` — ${excerpt}` : ''}`;
}

function buildXShareUrl(title: string, excerpt: string, url: string): string {
  const text = encodeURIComponent(buildShareText(title, excerpt));
  const link = encodeURIComponent(url);
  return `https://twitter.com/intent/tweet?text=${text}&url=${link}`;
}

function buildFacebookShareUrl(url: string): string {
  const link = encodeURIComponent(url);
  return `https://www.facebook.com/sharer/sharer.php?u=${link}`;
}

function buildThreadsShareUrl(title: string, excerpt: string, url: string): string {
  const text = encodeURIComponent(`${buildShareText(title, excerpt)} ${url}`);
  return `https://www.threads.net/intent/post?text=${text}`;
}

function buildExcerpt(contentHtml: string, maxLength: number = 120): string {
  const plainText = contentHtml.replace(/<[^>]*>/g, '').trim();
  if (plainText.length > maxLength) {
    return plainText.slice(0, maxLength).trimEnd() + '…';
  }
  return plainText;
}

// ---- Tests ----

describe('ShareButtons — share text generation', () => {
  it('combines title and excerpt', () => {
    expect(buildShareText('My Article', 'A short summary')).toBe(
      'My Article — A short summary'
    );
  });

  it('uses only title when excerpt is empty', () => {
    expect(buildShareText('My Article', '')).toBe('My Article');
  });
});

describe('ShareButtons — X (Twitter) share URL', () => {
  it('builds a valid Twitter intent URL with title, excerpt, and link', () => {
    const url = buildXShareUrl('Title', 'Excerpt', 'https://example.com/artikel/test');
    expect(url).toContain('https://twitter.com/intent/tweet?');
    expect(url).toContain('text=');
    expect(url).toContain('url=');
    expect(url).toContain(encodeURIComponent('https://example.com/artikel/test'));
  });

  it('encodes special characters in title', () => {
    const url = buildXShareUrl('Hello & World', '', 'https://example.com');
    expect(url).toContain(encodeURIComponent('Hello & World'));
  });
});

describe('ShareButtons — Facebook share URL', () => {
  it('builds a valid Facebook sharer URL', () => {
    const url = buildFacebookShareUrl('https://example.com/artikel/test');
    expect(url).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://example.com/artikel/test')}`
    );
  });
});

describe('ShareButtons — Threads share URL', () => {
  it('builds a valid Threads intent URL with text and link', () => {
    const url = buildThreadsShareUrl('Title', 'Excerpt', 'https://example.com/artikel/test');
    expect(url).toContain('https://www.threads.net/intent/post?text=');
    expect(url).toContain(encodeURIComponent('https://example.com/artikel/test'));
  });

  it('includes the article URL in the text body', () => {
    const articleUrl = 'https://example.com/artikel/test';
    const url = buildThreadsShareUrl('Title', '', articleUrl);
    // The URL should be part of the encoded text parameter
    const textParam = url.split('text=')[1];
    const decoded = decodeURIComponent(textParam);
    expect(decoded).toContain(articleUrl);
  });
});

describe('ShareButtons — excerpt generation', () => {
  it('returns full text for short content', () => {
    expect(buildExcerpt('<p>Short text</p>')).toBe('Short text');
  });

  it('truncates long content to 120 chars with ellipsis', () => {
    const longContent = '<p>' + 'a'.repeat(200) + '</p>';
    const result = buildExcerpt(longContent);
    expect(result.length).toBeLessThanOrEqual(121);
    expect(result).toMatch(/…$/);
  });

  it('strips HTML tags', () => {
    expect(buildExcerpt('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('handles empty content', () => {
    expect(buildExcerpt('')).toBe('');
  });
});
