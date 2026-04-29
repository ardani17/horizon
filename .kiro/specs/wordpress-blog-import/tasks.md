# Implementation Plan: WordPress Blog Import

## Overview

This plan implements the WordPress blog import feature by building foundation layers first (types, constants, migration, config), then the import script, followed by UI components and pages, and finally navigation and admin integration. Each task builds on the previous steps, and all code is wired together by the end.

## Tasks

- [x] 1. Foundation — Type system, constants, migration, and config updates
  - [x] 1.1 Add `BLOG` to `ArticleCategory` and `WORDPRESS` to `ArticleSource` in `shared/types/index.ts`
    - Add `BLOG: 'blog'` entry to the `ArticleCategory` const object
    - Add `WORDPRESS: 'wordpress'` entry to the `ArticleSource` const object
    - _Requirements: 1.3, 1.4_

  - [x] 1.2 Add `'blog'` to `VALID_CATEGORIES` and `BLOG_PAGE_SIZE` to `PAGINATION` in `shared/constants.ts`
    - Append `'blog'` to the `VALID_CATEGORIES` array
    - Add `BLOG_PAGE_SIZE: 12` to the `PAGINATION` object
    - _Requirements: 1.2_

  - [x] 1.3 Add `'blog'` label to `categoryLabels` in `frontend/src/components/article/ArticleMeta.tsx`
    - Add `blog: 'Blog'` entry to the `categoryLabels` record
    - _Requirements: 1.2_

  - [x] 1.4 Create database migration `db/migrations/006_add_blog_category.sql`
    - Insert `credit_settings` row for `blog` category with `credit_reward=0` and `is_active=true`
    - Use `ON CONFLICT (category) DO NOTHING` for idempotency
    - _Requirements: 2.1_

  - [x] 1.5 Update Next.js config `frontend/next.config.mjs` for WordPress images
    - Add `academy.horizonfx.id` to `images.remotePatterns`
    - Add `https://academy.horizonfx.id` to CSP `img-src` directive
    - Add `https://academy.horizonfx.id` to CSP `media-src` directive
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.6 Add `'blog'` to `validCategories` in API routes
    - Update `validCategories` array in `frontend/src/app/api/articles/route.ts` (POST handler)
    - Update `validCategories` array in `frontend/src/app/api/articles/[id]/route.ts` (PUT handler)
    - _Requirements: 1.5_

- [x] 2. Checkpoint — Verify foundation changes
  - Ensure the type system compiles without errors, the migration SQL is valid, and the Next.js config is syntactically correct. Ask the user if questions arise.

- [x] 3. WordPress import script
  - [x] 3.1 Create `scripts/import-wordpress.js` — WordPress blog import script
    - Connect to PostgreSQL using `DATABASE_URL` or individual `POSTGRES_*` env vars
    - Look up admin user by `telegram_id=0` to get `author_id`
    - Fetch all published posts from `https://academy.horizonfx.id/wp-json/wp/v2/posts?per_page=100&_embed` with pagination using `X-WP-TotalPages` header
    - For each post: extract `title.rendered`, `content.rendered`, `excerpt.rendered`, `slug`, `date`, and featured media URL from `_embedded['wp:featuredmedia']`
    - Skip posts whose slug already exists in the `articles` table (log skip message)
    - Insert into `articles` with `category='blog'`, `source='wordpress'`, `status='published'`, preserving original WordPress `date` as `created_at`
    - If featured image exists, insert into `media` table with `media_type='image'`
    - Do NOT create credit transactions
    - Log progress: total fetched, imported, skipped
    - Handle errors: HTTP errors → log and exit code 1; individual DB insert failures → log and continue; DB connection failure → log and exit code 1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 2.2_

  - [ ]* 3.2 Write property test for WordPress post data extraction (Property 1)
    - **Property 1: WordPress post data extraction preserves all required fields**
    - Extract the `extractPostData` function or equivalent logic into a testable unit
    - Generate random WordPress post JSON objects with `title.rendered`, `content.rendered`, `excerpt.rendered`, `slug`, `date`, and optional `_embedded['wp:featuredmedia']`
    - Verify output fields match input fields exactly, and `featuredImageUrl` is `source_url` when present or `null` when absent
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 3.3**

- [x] 4. BlogCard component
  - [x] 4.1 Create `frontend/src/components/blog/BlogCard.tsx` and `BlogCard.module.css`
    - Follow the `OutlookCard` pattern: display featured image thumbnail (or 📝 placeholder), "Blog" badge, publication date, title linked to `/blog/[slug]`, excerpt (first 200 chars of plain text), author name, and estimated read time
    - Export `BlogCardData` interface with fields: `id`, `title`, `content_html`, `slug`, `created_at`, `author_name`, `cover_image`
    - _Requirements: 5.3_

  - [x] 4.2 Create `frontend/src/components/blog/index.ts` barrel export
    - Export `BlogCard` component and `BlogCardData` type
    - _Requirements: 5.3_

  - [ ]* 4.3 Write property test for BlogCard rendering (Property 2)
    - **Property 2: Blog card renders all required information**
    - Generate random `BlogCardData` objects with non-empty title, non-empty content_html, valid ISO date, and optional cover image URL
    - Verify rendered output contains the article title, a text excerpt, a formatted date, and the cover image (or placeholder)
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 5.3**

- [x] 5. Public blog pages
  - [x] 5.1 Create blog listing page `frontend/src/app/blog/page.tsx` and `page.module.css`
    - Server component querying `articles` where `category='blog'` and `status='published'`, ordered by `created_at DESC`
    - Support server-side pagination via `?page=N` search param (page size: 12 from `PAGINATION.BLOG_PAGE_SIZE`)
    - Support search filtering via `?search=keyword` search param
    - Render `BlogCard` for each article, include `Sidebar` component
    - Show empty state when no articles exist ("Belum ada artikel Blog")
    - Export SEO metadata (title, description, canonical URL)
    - Follow the same layout pattern as the Outlook listing page
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 5.2 Create blog detail page `frontend/src/app/blog/[slug]/page.tsx` and `page.module.css`
    - Server component following the Outlook detail page pattern
    - Query article by slug with `category='blog'` and `status='published'`
    - Fetch associated media, comment count, and like count
    - Render: back link ("← Kembali ke Blog") → title → ArticleMeta → featured image → article content (sanitized HTML) → stats → ShareButtons → CommentSection → LikeButton
    - Include JSON-LD structured data (Article schema)
    - Export `generateMetadata` for OG/Twitter Card metadata
    - Export `generateStaticParams` for SSG of recent blog articles
    - Use ISR with 5-minute revalidation (`revalidate = 300`)
    - Return 404 via `notFound()` for invalid slugs
    - Include `Sidebar` component
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

  - [ ]* 5.3 Write property test for blog detail JSON-LD (Property 3)
    - **Property 3: Blog detail page JSON-LD contains all required Article schema fields**
    - Generate random article data with title, content_html, created_at, author name, and slug
    - Build JSON-LD object using the same logic as the detail page
    - Verify `@context`, `@type`, `headline`, `datePublished`, `author.name`, `publisher`, and `url` are all present and correct
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 6.10**

  - [ ]* 5.4 Write property test for blog detail metadata (Property 4)
    - **Property 4: Blog detail page metadata contains OG and Twitter Card fields**
    - Generate random article data with title, content_html, and slug
    - Call the metadata generation logic
    - Verify output contains `openGraph.title`, `openGraph.description`, `openGraph.url`, `openGraph.type='article'`, `openGraph.images`, `twitter.card='summary_large_image'`, `twitter.title`, `twitter.description`, `twitter.images`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 6.11**

- [x] 6. Checkpoint — Verify blog pages
  - Ensure all tests pass, the blog listing page renders correctly, and the blog detail page handles both valid and invalid slugs. Ask the user if questions arise.

- [x] 7. Navigation updates
  - [x] 7.1 Add "Blog" link to Navbar in `frontend/src/components/layout/Navbar.tsx`
    - Add `{ label: 'Blog', href: '/blog' }` to `navItems` array between "Outlook" and "Gallery"
    - _Requirements: 7.1, 7.2_

  - [x] 7.2 Add "Blog" link to public Sidebar in `frontend/src/components/layout/Sidebar.tsx`
    - Add `{ label: 'Blog', href: '/blog' }` to `categories` array between "Outlook" and "Gallery"
    - _Requirements: 5.7_

  - [x] 7.3 Add "Blog" link to Admin Sidebar in `frontend/src/app/admin/(dashboard)/AdminSidebar.tsx`
    - Add `{ label: 'Blog', href: '/admin/blog', icon: '📰' }` to the "Utama" section after "Outlook"
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. Admin blog management page
  - [x] 8.1 Create `frontend/src/app/admin/(dashboard)/blog/page.tsx` and `blog.module.css`
    - Client component following the `AdminOutlookPage` pattern
    - Fetch articles from `/api/articles?category=blog` with pagination, search, and status filter
    - DataTable with columns: title (linked to edit page), status badge, author, media count, date, actions (edit, toggle status, delete)
    - No "New Blog" button (blog articles come from WordPress import only)
    - _Requirements: 8.1, 8.2_

- [x] 9. Final checkpoint — Verify complete integration
  - Ensure all tests pass, navigation links are correct, admin blog page loads, and the full feature is wired together. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The import script (`scripts/import-wordpress.js`) is standalone Node.js and connects to PostgreSQL directly — it does not use the Next.js API routes
- All blog pages follow the existing Outlook page pattern for consistency
- WordPress images keep their original URLs (no re-upload to R2)
