import { describe, it, expect } from 'vitest';

// ---- Pure logic extracted from SEO metadata generation for testing ----

interface MediaItem {
  id: string;
  file_url: string;
  media_type: string;
}

interface ArticleForSeo {
  title: string | null;
  content_html: string;
  slug: string;
  created_at: string;
  author_name: string | null;
  media: MediaItem[];
}

function generateDescription(contentHtml: string): string {
  const plainText = contentHtml.replace(/<[^>]*>/g, '').trim();
  return plainText.length > 160
    ? plainText.slice(0, 160).trimEnd() + '…'
    : plainText;
}

function getOgImage(
  media: MediaItem[],
  baseUrl: string,
): string {
  const firstImage = media.find((m) => m.media_type === 'image');
  return firstImage?.file_url || `${baseUrl}/images/og-default.svg`;
}

function generateArticleMetadata(
  article: ArticleForSeo,
  baseUrl: string,
  pathPrefix: string,
) {
  const url = `${baseUrl}/${pathPrefix}/${article.slug}`;
  const description = generateDescription(article.content_html);
  const title = article.title || description.slice(0, 60);
  const ogImage = getOgImage(article.media, baseUrl);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article' as const,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [ogImage],
    },
  };
}

function generateJsonLd(
  article: ArticleForSeo,
  baseUrl: string,
  pathPrefix: string,
) {
  const url = `${baseUrl}/${pathPrefix}/${article.slug}`;
  const plainText = article.content_html.replace(/<[^>]*>/g, '').trim();
  const excerpt = plainText.length > 120
    ? plainText.slice(0, 120).trimEnd() + '…'
    : plainText;
  const displayTitle =
    article.title ||
    article.content_html.replace(/<[^>]*>/g, '').trim().slice(0, 80);
  const firstImage = article.media.find((m) => m.media_type === 'image');

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: displayTitle,
    description: excerpt,
    image: firstImage?.file_url || `${baseUrl}/images/og-default.svg`,
    datePublished: article.created_at,
    author: {
      '@type': 'Person',
      name: article.author_name || 'Anonim',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Horizon Trader Platform',
    },
    url,
  };
}

// ---- Tests ----

describe('SEO: Open Graph meta tags', () => {
  const baseUrl = 'https://horizon.example.com';

  it('includes og:title, og:description, og:url, og:image for article with media', () => {
    const article: ArticleForSeo = {
      title: 'Analisa BTC Hari Ini',
      content_html: '<p>Bitcoin menunjukkan tren bullish.</p>',
      slug: 'analisa-btc-hari-ini-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'trader1',
      media: [
        { id: '1', file_url: 'https://r2.dev/img1.jpg', media_type: 'image' },
      ],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'artikel');

    expect(meta.openGraph.title).toBe('Analisa BTC Hari Ini');
    expect(meta.openGraph.description).toBe('Bitcoin menunjukkan tren bullish.');
    expect(meta.openGraph.url).toBe(`${baseUrl}/artikel/${article.slug}`);
    expect(meta.openGraph.images[0].url).toBe('https://r2.dev/img1.jpg');
    expect(meta.openGraph.type).toBe('article');
  });

  it('uses first image media as og:image', () => {
    const article: ArticleForSeo = {
      title: 'Test',
      content_html: '<p>Content</p>',
      slug: 'test-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [
        { id: '1', file_url: 'https://r2.dev/video.mp4', media_type: 'video' },
        { id: '2', file_url: 'https://r2.dev/img1.jpg', media_type: 'image' },
        { id: '3', file_url: 'https://r2.dev/img2.jpg', media_type: 'image' },
      ],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'artikel');
    expect(meta.openGraph.images[0].url).toBe('https://r2.dev/img1.jpg');
  });

  it('falls back to platform default when no image media', () => {
    const article: ArticleForSeo = {
      title: 'No Media',
      content_html: '<p>Text only article</p>',
      slug: 'no-media-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'artikel');
    expect(meta.openGraph.images[0].url).toBe(`${baseUrl}/images/og-default.svg`);
  });

  it('falls back to default when only video media exists', () => {
    const article: ArticleForSeo = {
      title: 'Video Only',
      content_html: '<p>Video article</p>',
      slug: 'video-only-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [
        { id: '1', file_url: 'https://r2.dev/video.mp4', media_type: 'video' },
      ],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'artikel');
    expect(meta.openGraph.images[0].url).toBe(`${baseUrl}/images/og-default.svg`);
  });
});

describe('SEO: Twitter Card meta tags', () => {
  const baseUrl = 'https://horizon.example.com';

  it('includes twitter:card, twitter:title, twitter:description, twitter:image', () => {
    const article: ArticleForSeo = {
      title: 'Market Update',
      content_html: '<p>Pasar sedang volatile.</p>',
      slug: 'market-update-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'analyst1',
      media: [
        { id: '1', file_url: 'https://r2.dev/chart.jpg', media_type: 'image' },
      ],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'outlook');

    expect(meta.twitter.card).toBe('summary_large_image');
    expect(meta.twitter.title).toBe('Market Update');
    expect(meta.twitter.description).toBe('Pasar sedang volatile.');
    expect(meta.twitter.images[0]).toBe('https://r2.dev/chart.jpg');
  });
});

describe('SEO: Canonical URL', () => {
  const baseUrl = 'https://horizon.example.com';

  it('sets canonical URL for article pages', () => {
    const article: ArticleForSeo = {
      title: 'Test Article',
      content_html: '<p>Content</p>',
      slug: 'test-article-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'artikel');
    expect(meta.alternates.canonical).toBe(`${baseUrl}/artikel/test-article-abc123`);
  });

  it('sets canonical URL for outlook pages', () => {
    const article: ArticleForSeo = {
      title: 'Outlook Analysis',
      content_html: '<p>Analysis content</p>',
      slug: 'outlook-analysis-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'analyst1',
      media: [],
    };

    const meta = generateArticleMetadata(article, baseUrl, 'outlook');
    expect(meta.alternates.canonical).toBe(`${baseUrl}/outlook/outlook-analysis-abc123`);
  });
});

describe('SEO: JSON-LD structured data', () => {
  const baseUrl = 'https://horizon.example.com';

  it('generates valid Article schema with all required fields', () => {
    const article: ArticleForSeo = {
      title: 'Analisa Teknikal BTC',
      content_html: '<p>Bitcoin menunjukkan pola bullish flag pada timeframe 4H.</p>',
      slug: 'analisa-teknikal-btc-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'trader1',
      media: [
        { id: '1', file_url: 'https://r2.dev/chart.jpg', media_type: 'image' },
      ],
    };

    const jsonLd = generateJsonLd(article, baseUrl, 'artikel');

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.headline).toBe('Analisa Teknikal BTC');
    expect(jsonLd.datePublished).toBe('2024-06-15T10:00:00Z');
    expect(jsonLd.image).toBe('https://r2.dev/chart.jpg');
    expect(jsonLd.author.name).toBe('trader1');
    expect(jsonLd.publisher.name).toBe('Horizon Trader Platform');
    expect(jsonLd.url).toBe(`${baseUrl}/artikel/analisa-teknikal-btc-abc123`);
    expect(jsonLd.description).toBeTruthy();
  });

  it('uses "Anonim" as author when author_name is null', () => {
    const article: ArticleForSeo = {
      title: 'Anonymous Post',
      content_html: '<p>Content</p>',
      slug: 'anon-post-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: null,
      media: [],
    };

    const jsonLd = generateJsonLd(article, baseUrl, 'artikel');
    expect(jsonLd.author.name).toBe('Anonim');
  });

  it('uses default image when no media', () => {
    const article: ArticleForSeo = {
      title: 'No Image',
      content_html: '<p>Text only</p>',
      slug: 'no-image-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [],
    };

    const jsonLd = generateJsonLd(article, baseUrl, 'artikel');
    expect(jsonLd.image).toBe(`${baseUrl}/images/og-default.svg`);
  });

  it('falls back to content excerpt for headline when title is null', () => {
    const article: ArticleForSeo = {
      title: null,
      content_html: '<p>This is a short post about trading</p>',
      slug: 'short-post-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [],
    };

    const jsonLd = generateJsonLd(article, baseUrl, 'artikel');
    expect(jsonLd.headline).toBe('This is a short post about trading');
  });
});

describe('SEO: Title format', () => {
  it('uses article title when available', () => {
    const article: ArticleForSeo = {
      title: 'My Great Article',
      content_html: '<p>Content here</p>',
      slug: 'my-great-article-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [],
    };

    const meta = generateArticleMetadata(article, 'https://example.com', 'artikel');
    // Title will be combined with template "%s | Horizon" by Next.js
    expect(meta.title).toBe('My Great Article');
  });

  it('falls back to description excerpt when title is null', () => {
    const article: ArticleForSeo = {
      title: null,
      content_html: '<p>This is the content of the article</p>',
      slug: 'content-abc123',
      created_at: '2024-06-15T10:00:00Z',
      author_name: 'user1',
      media: [],
    };

    const meta = generateArticleMetadata(article, 'https://example.com', 'artikel');
    expect(meta.title).toBe('This is the content of the article');
  });
});
