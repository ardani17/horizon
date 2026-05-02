// ============================================
// Property-Based Tests — WordPress Import
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  sanitizeWordPressHtml,
  extractPostData,
  executeWordPressImport,
} from '../../shared/services/wordpressImport';
import type { WordPressPost } from '../../shared/types/index';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a random URL-like string */
const arbUrl = fc.oneof(
  fc.webUrl(),
  fc.constant(''),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_./:%?&#'.split('')), { minLength: 1, maxLength: 80 }),
);

/** Generate an optional HTML attribute */
function optionalAttr(name: string, valueArb: fc.Arbitrary<string> = arbUrl): fc.Arbitrary<string> {
  return fc.oneof(
    fc.constant(''),
    valueArb.map((v) => ` ${name}="${v}"`),
  );
}

/** Generate an <img> tag with various lazy-load attribute combinations */
const arbImgTag: fc.Arbitrary<string> = fc.tuple(
  optionalAttr('src'),
  optionalAttr('data-src'),
  optionalAttr('data-srcset'),
  optionalAttr('data-sizes'),
  fc.oneof(
    fc.constant(''),
    fc.constant(' class="lazyload"'),
    fc.constant(' class="some-class lazyload other"'),
    fc.constant(' class="img-responsive"'),
  ),
  optionalAttr('alt', fc.string({ minLength: 0, maxLength: 30 })),
).map(([src, dataSrc, dataSrcset, dataSizes, cls, alt]) =>
  `<img${src}${dataSrc}${dataSrcset}${dataSizes}${cls}${alt}>`,
);

/** Generate arbitrary HTML that may contain img tags */
const arbHtmlWithImages: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      { weight: 3, arbitrary: arbImgTag },
      { weight: 2, arbitrary: fc.constant('<p>Hello world</p>') },
      { weight: 1, arbitrary: fc.string({ minLength: 0, maxLength: 60 }) },
      { weight: 1, arbitrary: fc.constant('<div class="lazyload">text</div>') },
    ),
    { minLength: 0, maxLength: 8 },
  )
  .map((parts) => parts.join(''));

/** Generate a valid WordPress post object */
const arbWordPressPost: fc.Arbitrary<WordPressPost> = fc.record({
  title: fc.record({ rendered: fc.string({ minLength: 1, maxLength: 100 }) }),
  content: fc.record({ rendered: arbHtmlWithImages }),
  excerpt: fc.record({ rendered: fc.string({ minLength: 0, maxLength: 200 }) }),
  slug: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
    minLength: 1,
    maxLength: 60,
  }),
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
  _embedded: fc.oneof(
    fc.constant(undefined),
    fc.record({
      'wp:featuredmedia': fc.oneof(
        fc.constant(undefined),
        fc.constant([] as Array<{ source_url?: string }>),
        fc.tuple(
          fc.oneof(
            fc.record({ source_url: arbUrl }),
            fc.record({ source_url: fc.constant(undefined) }),
          ),
        ),
      ),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Property 1: HTML sanitization is idempotent
// ---------------------------------------------------------------------------

describe('Feature: admin-wordpress-import, Property 1: HTML sanitization is idempotent', () => {
  /**
   * **Validates: Requirements 8.2, 8.3**
   *
   * For any HTML string, applying sanitizeWordPressHtml twice should produce
   * the same result as applying it once.
   */
  it('sanitizeWordPressHtml(sanitizeWordPressHtml(html)) === sanitizeWordPressHtml(html)', () => {
    fc.assert(
      fc.property(arbHtmlWithImages, (html) => {
        const once = sanitizeWordPressHtml(html);
        const twice = sanitizeWordPressHtml(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Post data extraction preserves source fields
// ---------------------------------------------------------------------------

describe('Feature: admin-wordpress-import, Property 2: Post data extraction preserves source fields', () => {
  /**
   * **Validates: Requirements 2.6, 8.2**
   *
   * For any valid WordPress post object, extractPostData should return an
   * object where title, slug, date, and featuredImageUrl match the source.
   */
  it('extractPostData preserves title, slug, date, and featuredImageUrl from the source post', () => {
    fc.assert(
      fc.property(arbWordPressPost, (post) => {
        const result = extractPostData(post);

        expect(result.title).toBe(post.title.rendered);
        expect(result.slug).toBe(post.slug);
        expect(result.date).toBe(post.date);

        const expectedMedia = post._embedded?.['wp:featuredmedia']?.[0];
        const expectedUrl = expectedMedia?.source_url ?? null;
        expect(result.featuredImageUrl).toBe(expectedUrl);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Import job accounting invariant
// ---------------------------------------------------------------------------

describe('Feature: admin-wordpress-import, Property 3: Import job accounting invariant', () => {
  /**
   * **Validates: Requirements 2.7, 4.2**
   *
   * For any set of WordPress posts processed by the import logic,
   * total_imported + total_skipped + total_failed === total_fetched.
   */
  it('total_imported + total_skipped + total_failed === total_fetched', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a list of posts and a set of "existing" slugs
        fc.array(arbWordPressPost, { minLength: 0, maxLength: 15 }),
        fc.uniqueArray(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
            minLength: 1,
            maxLength: 60,
          }),
          { minLength: 0, maxLength: 10 },
        ),
        // Whether each post's DB insert should fail
        fc.array(fc.boolean(), { minLength: 0, maxLength: 15 }),
        async (posts, existingSlugs, failFlags) => {
          const existingSet = new Set(existingSlugs);

          // Track which posts will fail insertion (only non-skipped posts)
          let nonSkippedIndex = 0;

          // Mock the db module
          const dbModule = await import('../../shared/db/query');

          // Mock query (used by insertArticle)
          vi.spyOn(dbModule, 'query').mockImplementation(async (_sql: string, params?: unknown[]) => {
            // insertArticle call — may fail based on failFlags
            const shouldFail = failFlags[nonSkippedIndex % failFlags.length] ?? false;
            nonSkippedIndex++;
            if (shouldFail) {
              throw new Error('Simulated DB insert failure');
            }
            return { rows: [{ id: 'mock-article-id' }], rowCount: 1 };
          });

          // Mock queryOne (used by slugExists)
          vi.spyOn(dbModule, 'queryOne').mockImplementation(async (_sql: string, params?: unknown[]) => {
            const slug = params?.[0] as string;
            return existingSet.has(slug) ? { exists: true } : null;
          });

          // Mock execute (used by insertMedia)
          vi.spyOn(dbModule, 'execute').mockImplementation(async () => 1);

          // Mock global fetch for WordPress API
          const mockFetch = vi.fn().mockImplementation(async (url: string) => {
            return {
              ok: true,
              headers: new Headers({ 'X-WP-TotalPages': '1' }),
              json: async () => posts,
              text: async () => '',
            };
          });
          vi.stubGlobal('fetch', mockFetch);

          const onProgress = vi.fn().mockResolvedValue(undefined);

          const counts = await executeWordPressImport({
            authorId: 'test-admin-id',
            jobId: 'test-job-id',
            onProgress,
          });

          // The accounting invariant
          expect(counts.total_imported + counts.total_skipped + counts.total_failed).toBe(
            counts.total_fetched,
          );
          expect(counts.total_fetched).toBe(posts.length);

          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: API-imported articles use correct metadata
// ---------------------------------------------------------------------------

describe('Feature: admin-wordpress-import, Property 4: API-imported articles use correct metadata', () => {
  /**
   * **Validates: Requirements 7.4, 8.3**
   *
   * For any WordPress post imported via the shared import logic, the resulting
   * article has category='blog', source='wordpress', and author_id matching
   * the provided admin ID.
   */
  it('imported articles have category=blog, source=wordpress, and correct author_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbWordPressPost,
        fc.uuid(),
        async (post, adminId) => {
          const insertedArticles: Array<{ sql: string; params: unknown[] }> = [];
          const insertedMedia: Array<{ sql: string; params: unknown[] }> = [];

          const dbModule = await import('../../shared/db/query');

          // Mock query — capture insertArticle calls
          vi.spyOn(dbModule, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
            insertedArticles.push({ sql, params: params ?? [] });
            return { rows: [{ id: 'mock-article-id' }], rowCount: 1 };
          });

          // Mock queryOne — no existing slugs so the post gets imported
          vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);

          // Mock execute — capture insertMedia calls
          vi.spyOn(dbModule, 'execute').mockImplementation(async (sql: string, params?: unknown[]) => {
            insertedMedia.push({ sql, params: params ?? [] });
            return 1;
          });

          // Mock fetch — return a single post
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'X-WP-TotalPages': '1' }),
            json: async () => [post],
            text: async () => '',
          }));

          const onProgress = vi.fn().mockResolvedValue(undefined);

          await executeWordPressImport({
            authorId: adminId,
            jobId: 'test-job-id',
            onProgress,
          });

          // Verify the article was inserted with correct metadata
          expect(insertedArticles.length).toBe(1);
          const insertCall = insertedArticles[0];

          // The INSERT SQL should contain 'blog' and 'wordpress'
          expect(insertCall.sql).toContain("'blog'");
          expect(insertCall.sql).toContain("'wordpress'");

          // The first param is author_id
          expect(insertCall.params[0]).toBe(adminId);

          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});
