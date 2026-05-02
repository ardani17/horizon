// ============================================
// Horizon Trader Platform — WordPress Import Service
// ============================================

import { query, queryOne, execute } from '../db/query';
import type { WordPressPost, ExtractedPost, ImportCounts } from '../types/index';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WP_API_BASE = 'https://academy.horizonfx.id/wp-json/wp/v2/posts';
const PER_PAGE = 100;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize WordPress HTML to fix lazy-loaded images.
 *
 * WordPress plugins (e.g. Smush, LazyLoad) move the real image URL to
 * `data-src` / `data-srcset` and leave `src` empty or with a placeholder.
 * Since we don't ship the WP lazy-load JS, we need to promote `data-src`
 * back to `src` so images render immediately.
 *
 * Also strips the `lazyload` CSS class and `data-src` / `data-srcset` /
 * `data-sizes` attributes after promotion.
 */
export function sanitizeWordPressHtml(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, (imgTag: string) => {
      let tag = imgTag;

      // If data-src exists, use it as src
      const dataSrcMatch = tag.match(/data-src="([^"]+)"/);
      if (dataSrcMatch) {
        const realSrc = dataSrcMatch[1];
        // Replace existing src or add src
        if (/\bsrc="[^"]*"/.test(tag)) {
          tag = tag.replace(/\bsrc="[^"]*"/, `src="${realSrc}"`);
        } else {
          tag = tag.replace('<img', `<img src="${realSrc}"`);
        }
      }

      // If data-srcset exists, promote to srcset
      const dataSrcsetMatch = tag.match(/data-srcset="([^"]+)"/);
      if (dataSrcsetMatch) {
        const realSrcset = dataSrcsetMatch[1];
        if (/\bsrcset="[^"]*"/.test(tag)) {
          tag = tag.replace(/\bsrcset="[^"]*"/, `srcset="${realSrcset}"`);
        } else {
          tag = tag.replace('<img', `<img srcset="${realSrcset}"`);
        }
      }

      // Remove data-src, data-srcset, data-sizes attributes
      tag = tag.replace(/\s*data-src="[^"]*"/g, '');
      tag = tag.replace(/\s*data-srcset="[^"]*"/g, '');
      tag = tag.replace(/\s*data-sizes="[^"]*"/g, '');

      // Remove lazyload class
      tag = tag.replace(/\blazyload\b/g, '');
      // Clean up empty class attribute or extra spaces in class
      tag = tag.replace(/class="\s*"/g, '');
      tag = tag.replace(/class="([^"]*)"/g, (_m: string, classes: string) => {
        const cleaned = classes.replace(/\s+/g, ' ').trim();
        return cleaned ? `class="${cleaned}"` : '';
      });

      return tag;
    });
}

/**
 * Extract relevant fields from a WordPress REST API post object.
 *
 * @param post — A single post from the WP REST API (with _embed).
 * @returns Extracted post data with sanitized HTML content.
 */
export function extractPostData(post: WordPressPost): ExtractedPost {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  return {
    title: post.title.rendered,
    contentHtml: sanitizeWordPressHtml(post.content.rendered),
    excerpt: post.excerpt.rendered,
    slug: post.slug,
    date: post.date,
    featuredImageUrl: featuredMedia?.source_url ?? null,
  };
}

// ---------------------------------------------------------------------------
// WordPress API helpers
// ---------------------------------------------------------------------------

interface FetchPageResult {
  posts: WordPressPost[];
  totalPages: number;
}

async function fetchPage(page: number): Promise<FetchPageResult> {
  const url = `${WP_API_BASE}?per_page=${PER_PAGE}&page=${page}&_embed`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `WordPress API returned HTTP ${res.status} for page ${page}: ${body}`,
    );
  }

  const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
  const posts = (await res.json()) as WordPressPost[];
  return { posts, totalPages };
}

async function fetchAllPosts(): Promise<WordPressPost[]> {
  const allPosts: WordPressPost[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchPage(page);
    totalPages = result.totalPages;
    allPosts.push(...result.posts);
    page++;
  }

  return allPosts;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function slugExists(slug: string): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    'SELECT 1 AS exists FROM articles WHERE slug = $1 LIMIT 1',
    [slug],
  );
  return row !== null;
}

async function insertArticle(
  authorId: string,
  data: ExtractedPost,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO articles (author_id, title, content_html, category, source, status, slug, created_at)
     VALUES ($1, $2, $3, 'blog', 'wordpress', 'published', $4, $5)
     RETURNING id`,
    [authorId, data.title, data.contentHtml, data.slug, data.date],
  );
  return result.rows[0].id;
}

async function insertMedia(
  articleId: string,
  imageUrl: string,
): Promise<void> {
  await execute(
    `INSERT INTO media (article_id, file_url, media_type)
     VALUES ($1, $2, 'image')`,
    [articleId, imageUrl],
  );
}

// ---------------------------------------------------------------------------
// Import orchestrator
// ---------------------------------------------------------------------------

/**
 * Options for the WordPress import orchestrator.
 */
export interface ExecuteWordPressImportOptions {
  /** UUID of the admin user who triggered the import */
  authorId: string;
  /** UUID of the import job record */
  jobId: string;
  /** Callback invoked after each post is processed with current counts */
  onProgress: (counts: ImportCounts) => Promise<void>;
}

/**
 * Core import orchestrator — fetches all WordPress posts (paginated),
 * processes each post (check slug, insert article + media), calls
 * `onProgress` after each post, and returns final ImportCounts.
 *
 * Individual post failures are counted in `total_failed` but do not
 * stop the import. Fatal errors (WP API unreachable, etc.) are thrown
 * to the caller.
 */
export async function executeWordPressImport(
  options: ExecuteWordPressImportOptions,
): Promise<ImportCounts> {
  const { authorId, onProgress } = options;

  const counts: ImportCounts = {
    total_fetched: 0,
    total_imported: 0,
    total_skipped: 0,
    total_failed: 0,
  };

  // Fetch all posts from WordPress API (paginated)
  const posts = await fetchAllPosts();
  counts.total_fetched = posts.length;

  // Process each post
  for (const post of posts) {
    const data = extractPostData(post);

    try {
      if (await slugExists(data.slug)) {
        counts.total_skipped++;
      } else {
        const articleId = await insertArticle(authorId, data);

        if (data.featuredImageUrl) {
          await insertMedia(articleId, data.featuredImageUrl);
        }

        counts.total_imported++;
      }
    } catch {
      counts.total_failed++;
    }

    // Notify progress after each post
    await onProgress(counts);
  }

  return counts;
}
