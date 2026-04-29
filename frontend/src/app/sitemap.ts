import type { MetadataRoute } from 'next';
import { query } from '@shared/db';

interface SitemapArticleRow {
  slug: string;
  category: string;
  created_at: Date;
}

/**
 * Dynamic sitemap generator for Next.js App Router.
 * Queries the database for all published articles and outlook articles,
 * generating URLs with lastmod dates.
 *
 * Validates: Requirements 21.4
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Static pages with a fixed lastmod
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/outlook`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];

  // Fetch all published articles from the database
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const result = await query<SitemapArticleRow>(
      `SELECT slug, category, created_at
       FROM articles
       WHERE status = $1
       ORDER BY created_at DESC`,
      ['published']
    );

    articlePages = result.rows.map((row) => {
      const lastModified =
        row.created_at instanceof Date
          ? row.created_at
          : new Date(String(row.created_at));

      // Outlook articles use /outlook/[slug], others use /artikel/[slug]
      const path =
        row.category === 'outlook'
          ? `/outlook/${row.slug}`
          : `/artikel/${row.slug}`;

      return {
        url: `${baseUrl}${path}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      };
    });
  } catch {
    // If the database is unavailable, return only static pages
  }

  return [...staticPages, ...articlePages];
}
