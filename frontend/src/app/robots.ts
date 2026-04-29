import type { MetadataRoute } from 'next';

/**
 * Robots.txt configuration for Next.js App Router.
 * Allows crawling of public pages and blocks admin dashboard
 * and internal API endpoints.
 *
 * Validates: Requirements 21.5
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/*',
          '/api/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
