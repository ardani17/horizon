# Implementation Plan: Horizon Trader Platform

## Overview

Implementasi Horizon Trader Platform secara bertahap — dimulai dari infrastruktur dan database, lalu core backend services (Bot + Credit API), kemudian frontend pages, dan terakhir integrasi serta polish. Setiap task membangun di atas task sebelumnya, memastikan tidak ada kode orphan. TypeScript digunakan di seluruh stack (Next.js + Node.js/Express bot service).

## Tasks

- [ ] 1. Project scaffolding, Docker infrastructure, and database setup
  - [x] 1.1 Create monorepo directory structure and initialize packages
    - Create root project with `frontend/` (Next.js App Router) and `bot/` (Node.js + Express) directories
    - Initialize `package.json` for both packages with TypeScript configuration
    - Set up shared TypeScript config (`tsconfig.base.json`) and ESLint config
    - Create `.env.example` with all required environment variables (DB credentials, Telegram Bot token, R2 keys, admin credentials)
    - _Requirements: 13.4_

  - [x] 1.2 Create Docker Compose configuration and Dockerfiles
    - Create `docker-compose.yml` defining services: `frontend` (Next.js :3000), `bot` (Express :4000), `db` (PostgreSQL), `nginx` (reverse proxy)
    - Create multi-stage `Dockerfile` for frontend (install → build → production runtime)
    - Create multi-stage `Dockerfile` for bot service (install → build → production runtime)
    - Configure `restart: unless-stopped` on all services
    - Define Docker named volume for PostgreSQL data persistence
    - Define internal Docker network `horizon-net` for service isolation
    - Add health checks for each service
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 13.7, 13.8, 13.9_

  - [x] 1.3 Create Nginx configuration
    - Configure reverse proxy rules: `/` → frontend:3000, `/api/bot/*` → bot:4000, `/api/credit/*` → frontend:3000, `/webhook/telegram` → bot:4000, `/admin/*` → frontend:3000
    - Set up SSL termination with Let's Encrypt (certbot)
    - Configure static asset caching with `Cache-Control` headers (max-age 1 year + content hashing)
    - Add rate limiting at Nginx level
    - _Requirements: 13.5, 19.4_

  - [x] 1.4 Create PostgreSQL database schema and seed data
    - Write SQL migration file creating all 10 tables: `users`, `articles`, `media`, `credit_transactions`, `credit_settings`, `activity_logs`, `comments`, `likes`, `api_keys`, `admin_sessions`
    - Create all indexes as specified in design (category, status, slug, created_at DESC, composite indexes, GIN index on activity_logs.details)
    - Add foreign key constraints with ON DELETE CASCADE where specified (media, comments, likes)
    - Seed `credit_settings` with default values (trading: 10, life_story: 5, general: 3)
    - Seed initial admin user with hashed password
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 21.10_


- [ ] 2. Shared utilities, data models, and core libraries
  - [x] 2.1 Create shared TypeScript types and interfaces
    - Define interfaces for all database entities: `User`, `Article`, `Media`, `CreditTransaction`, `CreditSettings`, `ActivityLog`, `Comment`, `Like`, `ApiKey`, `AdminSession`
    - Define API response types: `ApiSuccessResponse<T>`, `ApiErrorResponse` with error code registry
    - Define enums/constants for categories, roles, statuses, transaction types, source types
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 24.1_

  - [x] 2.2 Create database connection and query utilities
    - Set up PostgreSQL client (e.g., `pg` + connection pool) for both frontend and bot
    - Create base repository pattern with typed query helpers
    - Create transaction helper for atomic operations
    - _Requirements: 12.6, 12.7, 12.8_

  - [x] 2.3 Implement slug generation utility
    - Implement `slugify(input: string): string` — lowercase, replace spaces with hyphens, remove non-alphanumeric, append 6-char random suffix
    - Handle edge cases: empty input, special characters, very long titles (truncate to 60 chars)
    - _Requirements: 21.6_

  - [ ]* 2.4 Write property test for slug generation
    - **Property 17: Slug Generation Validity**
    - **Validates: Requirements 21.6**

  - [x] 2.5 Implement text-to-HTML conversion utility
    - Create `textToHtml(text: string): string` function for converting Telegram plain text to HTML
    - Handle line breaks, basic formatting, and URL auto-linking
    - _Requirements: 8.5_

  - [ ]* 2.6 Write property test for text-to-HTML conversion
    - **Property 7: Text-to-HTML Content Preservation**
    - **Validates: Requirements 8.5**

  - [x] 2.7 Implement unified error handling utilities
    - Create `AppError` class hierarchy with error codes matching the error code registry
    - Create error response formatter that produces consistent `ApiErrorResponse` structure
    - Map error codes to HTTP status codes (400, 401, 403, 404, 422, 429, 500)
    - _Requirements: 24.1, 24.7_

  - [ ]* 2.8 Write property test for error response structure
    - **Property 18: Error Response Structure Consistency**
    - **Validates: Requirements 24.1, 24.7**

  - [x] 2.9 Implement activity log service
    - Create `ActivityLogService` with `log(entry: ActivityLogInput): Promise<void>` method
    - Ensure logs are immutable (insert-only, no update/delete methods)
    - Support all actor types: admin, member, system, external_api
    - _Requirements: 23.1, 23.2, 23.7_

  - [x] 2.10 Implement media type validation utility
    - Create `validateMediaType(mimeType: string): boolean` that accepts only `image/*` and `video/*`
    - Return descriptive error messages for rejected types
    - _Requirements: 6.4_

  - [ ]* 2.11 Write property test for media type validation
    - **Property 22: Media Type Validation**
    - **Validates: Requirements 6.4**

- [ ] 3. Checkpoint — Verify infrastructure and shared utilities
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Docker Compose starts all services and they can communicate
  - Verify database schema is applied correctly with all tables and indexes


- [ ] 4. Telegram Bot service — core architecture and middleware
  - [x] 4.1 Set up Express server with webhook endpoint
    - Create Express app on port 4000 with JSON body parsing
    - Create `POST /webhook/telegram` endpoint to receive Telegram updates
    - Create `GET /api/bot/status` health check endpoint
    - Set up Telegram Bot library (grammy or telegraf) with webhook mode
    - _Requirements: 15.4, 13.9_

  - [x] 4.2 Implement middleware pipeline
    - Create `MiddlewarePipeline` class implementing the `MiddlewarePipeline` interface from design
    - Implement `use(middleware)` and `execute(ctx)` methods with sequential execution
    - Create Auth middleware: validate sender is member of Horizon Telegram group
    - Create Auto-Register middleware: upsert user record (create if not exists, use existing if found)
    - Create Logging middleware: log all incoming messages to activity_logs
    - Create Rate Limiter middleware: prevent spam from single user
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 15.7_

  - [ ]* 4.3 Write property test for middleware execution order
    - **Property 10: Middleware Execution Order**
    - **Validates: Requirements 15.7**

  - [x] 4.4 Implement command registry
    - Create `CommandRegistry` class implementing the `CommandRegistry` interface from design
    - Implement `register(handler)`, `resolve(message)`, and `listCommands()` methods
    - Support both command types (`/command`) and hashtag types (`#hashtag`)
    - Unregistered commands resolve to null
    - _Requirements: 15.1, 15.2, 15.3, 15.8_

  - [ ]* 4.5 Write property test for command registry
    - **Property 9: Command Registry Dynamic Registration**
    - **Validates: Requirements 15.3**

  - [x] 4.6 Implement hashtag parser and category mapper
    - Create `parseHashtags(text: string): string[]` to extract hashtags from message text
    - Create `mapHashtagToCategory(hashtags: string[]): Category` with mapping: `#jurnal`/`#trading` → "trading", `#cerita`/`#kehidupan` → "life_story", no match → "general"
    - Ensure deterministic mapping (same input → same output)
    - _Requirements: 8.1, 8.2, 8.7_

  - [ ]* 4.7 Write property test for hashtag-to-category mapping
    - **Property 5: Hashtag-to-Category Mapping**
    - **Validates: Requirements 8.1, 8.2, 9.2, 9.3**

- [ ] 5. Telegram Bot service — command handlers and media
  - [x] 5.1 Implement hashtag handler
    - Create `HashtagHandler` implementing `CommandHandler` interface
    - On trigger: parse hashtags → determine category → convert text to HTML → generate slug → insert article + credit transaction atomically
    - Handle messages with and without media attachments
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 5.2 Implement /story and /cerita command handlers
    - Create `StoryHandler`: category "life_story", content_type "short"
    - Create `CeritaHandler`: category "life_story", content_type "long"
    - Both: convert text to HTML → generate slug → insert article + credit transaction
    - _Requirements: 8.3, 8.4, 8.6_

  - [ ]* 5.3 Write property test for command routing correctness
    - **Property 6: Command Routing Correctness**
    - **Validates: Requirements 8.3, 8.4, 8.7, 15.8**

  - [x] 5.4 Implement /publish command handler (admin only)
    - Create `PublishHandler` with permission "admin"
    - Parse replied-to message, determine category from hashtags (default "general")
    - Reject non-admin users with notification message
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 5.5 Write property test for permission enforcement
    - **Property 8: Permission Enforcement**
    - **Validates: Requirements 9.4**

  - [ ]* 5.6 Write property test for bot never producing outlook category
    - **Property 21: Bot Never Produces Outlook Category**
    - **Validates: Requirements 27.7**

  - [x] 5.7 Implement media handling service
    - Create `MediaService` with methods to download from Telegram API and upload to Cloudflare R2
    - Store media records in database with file_url, media_type, file_key, file_size
    - Handle upload failures gracefully: log error, continue publishing article without media
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 13.10_

  - [x] 5.8 Implement credit award on article creation
    - Create `CreditService` with atomic credit award: read credit_settings → insert transaction → update user balance
    - Use database transaction for atomicity
    - Skip credit award when category reward is inactive (is_active = false)
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ]* 5.9 Write property test for credit calculation from settings
    - **Property 11: Credit Calculation from Settings**
    - **Validates: Requirements 16.1, 16.2**

  - [x] 5.10 Implement /help command handler
    - Return list of available commands with descriptions
    - _Requirements: 15.8_

  - [x] 5.11 Implement bot error handling
    - Ensure user-facing error messages are descriptive without internal info (no stack traces, table names, SQL)
    - Format: "Gagal [aksi]. [Penyebab]. [Saran tindakan]."
    - Log full error details to activity_logs
    - Implement retry with exponential backoff for Telegram API errors (max 3 attempts)
    - _Requirements: 24.4, 24.5, 24.6, 24.8_

  - [ ]* 5.12 Write property test for no internal info leakage in bot errors
    - **Property 19: No Internal Info Leakage in Bot Errors**
    - **Validates: Requirements 24.5**

  - [x] 5.13 Implement bot REST API endpoints
    - `GET /api/bot/status` — health and uptime
    - `GET /api/bot/commands` — list registered commands
    - `GET /api/bot/stats` — command usage statistics
    - `POST /api/bot/notify` — send notification to group
    - _Requirements: 15.4, 15.5_

- [ ] 6. Checkpoint — Verify bot service
  - Ensure all tests pass, ask the user if questions arise.
  - Verify bot webhook receives and processes messages correctly
  - Verify credit transactions are created atomically


- [ ] 7. Next.js Frontend — layout, theme, and public pages
  - [x] 7.1 Create root layout with retro blogger theme
    - Implement `app/layout.tsx` with Emerald Green, Dark Slate, Off-White color palette
    - Set up Sans-serif typography with boxy header style
    - Configure `font-display: swap` and preload for main fonts
    - Add viewport meta tag for mobile rendering
    - _Requirements: 4.1, 4.3, 14.7, 19.7_

  - [x] 7.2 Create Navbar and Sidebar components
    - Create `Navbar.tsx` (Server Component) with 3 items: Feed, Outlook, Gallery
    - Create `Sidebar.tsx` with category navigation and community info (retro style)
    - Create `MobileMenu.tsx` (Client Component) — hamburger icon triggers overlay sidebar
    - Create `Footer.tsx`
    - Ensure touch targets minimum 44x44px on mobile
    - _Requirements: 4.2, 14.1, 14.2, 14.3, 14.6_

  - [x] 7.3 Implement Feed page with category filters
    - Create `app/page.tsx` (SSR) — fetch published articles in reverse chronological order
    - Create `CategoryTabs.tsx` (Client Component) with tabs: "Semua", "Trading Room", "Life & Coffee"
    - Create `ArticleCard.tsx` for short content and `ArticleLongCard.tsx` for long-form preview
    - Display title, excerpt, author name, category, and publication date per card
    - Implement client-side category filtering without page navigation
    - Create `FeedList.tsx` with `Pagination.tsx` component
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 7.4 Write property tests for feed sorting and filtering
    - **Property 1: Chronological Sort Invariant**
    - **Property 2: Published-Only Filter**
    - **Property 3: Category Filter Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.5, 1.6, 1.7, 3.6, 5.3**

  - [ ]* 7.5 Write property test for pagination
    - **Property 4: Pagination Invariant**
    - **Validates: Requirements 1.8**

  - [x] 7.6 Implement Gallery page (Instagram-style grid)
    - Create `app/gallery/page.tsx` (SSR) — fetch all media in reverse chronological order
    - Create `GalleryGrid.tsx` with 3-column square grid layout
    - Create `GalleryItem.tsx` with center-crop thumbnails, hover overlay (article title + media type), play icon for videos
    - Create `Lightbox.tsx` (Client Component) — modal with full-size image or video player
    - Implement infinite scroll for loading more media
    - Responsive: 3 columns on all viewports, smaller thumbnails on mobile
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 14.4_

  - [x] 7.7 Implement Article detail page
    - Create `app/artikel/[slug]/page.tsx` (SSG + ISR) — fetch article with media, comments, likes
    - Create `ArticleContent.tsx` for rendered HTML content
    - Create `ArticleMeta.tsx` for author, date, read time
    - Differentiate layout by content_type: "short" = compact card, "long" = full-width reading layout with larger typography and spacing
    - Responsive full-width content on mobile with readable typography
    - _Requirements: 8.6, 14.5, 19.1_

  - [x] 7.8 Implement Outlook pages
    - Create `app/outlook/page.tsx` (SSR) — list outlook articles chronologically
    - Create `app/outlook/[slug]/page.tsx` (SSG + ISR) — detail page with long-form reading layout
    - Create `OutlookCard.tsx` with "Outlook" badge and cover image thumbnail
    - Create `OutlookContent.tsx` with full-width content, large typography, inline images
    - Display author, publication date, and estimated read time
    - _Requirements: 27.1, 27.2, 27.4, 27.8_

- [ ] 8. Next.js Frontend — social features (likes, comments, sharing)
  - [x] 8.1 Implement Like system
    - Create `LikeButton.tsx` (Client Component) with fingerprint-based deduplication
    - Create `POST /api/likes/route.ts` — toggle like with UNIQUE(article_id, fingerprint) constraint
    - Display like count on article detail page
    - _Requirements: 26.1, 26.2_

  - [ ]* 8.2 Write property test for like idempotency
    - **Property 20: Like Idempotency Per Fingerprint**
    - **Validates: Requirements 26.2**

  - [x] 8.3 Implement Comment system
    - Create `CommentSection.tsx` (Client Component) with chronological comment list (oldest first)
    - Create anonymous comment form with optional display name (default "Anonim")
    - Create `TelegramLoginWidget.tsx` (Client Component) for Telegram auth option
    - Verify Telegram login hash with HMAC-SHA256 using bot token
    - Display "Member" badge on comments from authenticated Telegram users
    - Create `POST /api/comments/route.ts` and `GET /api/comments/route.ts`
    - _Requirements: 26.3, 26.4, 26.5, 26.6, 26.7, 26.9_

  - [x] 8.4 Implement social sharing buttons
    - Create `ShareButtons.tsx` (Client Component) with X (Twitter), Facebook, Threads, Instagram share buttons
    - X: open share URL with title + excerpt + link
    - Facebook: open share URL with article link
    - Threads: open share URL with text + link
    - Instagram: copy link to clipboard + show toast notification
    - Create "Copy Link" button as additional option
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.8_

  - [x] 8.5 Implement SEO meta tags and structured data
    - Add Open Graph meta tags (og:title, og:description, og:image, og:url) and Twitter Card tags to article detail pages
    - Use first media item as og:image, fallback to platform default
    - Add JSON-LD structured data (Article type) with headline, author, datePublished, image, description
    - Set unique title and description meta tags per page with format "[Title] | Horizon"
    - Add canonical URL to every page
    - Use semantic heading hierarchy (H1, H2, H3) on all pages
    - _Requirements: 20.6, 20.7, 21.1, 21.2, 21.3, 21.7, 21.8, 21.9_

  - [ ]* 8.6 Write property test for OG meta tag completeness
    - **Property 16: OG Meta Tag Completeness**
    - **Validates: Requirements 20.6, 20.7**

  - [x] 8.7 Implement sitemap.xml and robots.txt
    - Create `app/sitemap.ts` — dynamic sitemap with all public page URLs and lastmod dates
    - Create `robots.txt` allowing public pages, blocking `/admin/*` and internal API endpoints
    - _Requirements: 21.4, 21.5_

- [ ] 9. Checkpoint — Verify public frontend pages
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Feed, Gallery, Article detail, and Outlook pages render correctly
  - Verify likes, comments, and sharing work end-to-end


- [ ] 10. Admin Dashboard — authentication and layout
  - [x] 10.1 Implement admin authentication
    - Create `app/admin/login/page.tsx` with username/password form
    - Create `POST /api/auth/login/route.ts` — validate credentials with bcrypt, create session token, store in `admin_sessions`, set HttpOnly + Secure + SameSite=Strict cookie
    - Create `POST /api/auth/logout/route.ts` — delete session, clear cookie
    - Create `AdminAuthGuard.tsx` wrapper — validate session on every admin page, redirect to login if invalid/expired
    - Log failed login attempts to activity_logs
    - _Requirements: 25.3, 25.4, 25.5, 25.6, 25.7, 5.5_

  - [x] 10.2 Create admin dashboard layout
    - Create `app/admin/layout.tsx` with sidebar navigation for all admin sections
    - Wrap with `AdminAuthGuard` for session validation
    - Include navigation links: Dashboard, Articles, Outlook, Users, Credits, Comments, Logs, API Keys
    - _Requirements: 5.5_

- [ ] 11. Admin Dashboard — content management
  - [x] 11.1 Implement dashboard statistics page
    - Create `app/admin/page.tsx` with summary cards: total members, total articles, total media, total circulating credits
    - Create `StatsCards.tsx` component
    - Create `Charts.tsx` (Client Component) with publication activity chart (per day/week/month with time range filter) and category distribution chart (pie/bar)
    - Display top contributors (most articles + highest credit) for selected period
    - Display active vs inactive members (based on 30-day publication activity)
    - Create `GET /api/stats/route.ts` endpoint
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [x] 11.2 Implement article management pages
    - Create `app/admin/articles/page.tsx` — list all articles with status, using `DataTable.tsx`
    - Create `app/admin/articles/[id]/edit/page.tsx` — edit form with `ArticleEditor.tsx` (rich text editor) for content_html and metadata
    - Create `app/admin/articles/new/page.tsx` — upload form with content, category selector, media attachment
    - Implement article status changes (published ↔ hidden) and deletion (cascade delete media from DB + R2)
    - Create API routes: `GET/POST /api/articles/route.ts`, `GET/PUT/DELETE /api/articles/[id]/route.ts`
    - Create `POST /api/media/upload/route.ts` for uploading media to Cloudflare R2
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 11.3 Implement Outlook upload page
    - Create `app/admin/outlook/new/page.tsx` with `OutlookEditor.tsx` — rich text editor supporting headings, bold, italic, lists, multiple inline image uploads, and preview
    - On publish: save article with category "outlook", content_type "long", source "dashboard", status "published"
    - _Requirements: 27.5, 27.6_

  - [x] 11.4 Implement user management pages
    - Create `app/admin/users/page.tsx` — list all users with Telegram ID, username, role, registration date, credit balance
    - Create `app/admin/users/[id]/page.tsx` — member profile detail with `UserProfile.tsx`: username, Telegram ID, role, registration date, credit balance, total articles, article list, articles per category, avg articles/month, last published article
    - Display credit transaction history (earned, spent, adjusted) on profile page
    - Implement role change functionality
    - Create API routes: `GET /api/users/route.ts`, `GET/PUT /api/users/[id]/route.ts`
    - _Requirements: 7.1, 7.2, 7.3, 16.6, 22.6, 22.7, 22.8_

  - [x] 11.5 Implement comment moderation page
    - Create `app/admin/comments/page.tsx` — list all comments with article reference, author, status
    - Implement hide and delete actions for comments
    - _Requirements: 26.8_

- [ ] 12. Admin Dashboard — credit settings, API keys, and activity logs
  - [x] 12.1 Implement credit settings page
    - Create `app/admin/credits/page.tsx` with `CreditSettings.tsx` form
    - Display categories (trading, life_story, general) with current reward values and active status
    - Allow editing reward values and toggling is_active per category
    - Implement manual credit adjustment: add/subtract credits for specific member with description
    - Display member credit transaction history
    - Create API routes: `GET/PUT /api/credit/settings/route.ts`, `POST /api/credit/adjust/route.ts`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 12.2 Implement API key management page
    - Create `app/admin/api-keys/page.tsx` — list API keys with app name, key prefix, created date, last used, active status
    - Implement create new API key: generate key, hash with bcrypt, store hash + prefix, display raw key once
    - Implement revoke (deactivate) API key
    - Configure allowed_origins per key for CORS
    - Create API routes: `GET/POST/DELETE /api/api-keys/route.ts`
    - _Requirements: 18.3_

  - [x] 12.3 Implement activity logs page
    - Create `app/admin/logs/page.tsx` with `LogViewer.tsx`
    - Display logs in reverse chronological order
    - Implement filters: time range, actor (specific user), action type, target type
    - Implement keyword search across details and action fields
    - Click on log entry to show full detail including JSONB details (before/after state)
    - Create `GET /api/logs/route.ts` with filter and search query params
    - _Requirements: 23.3, 23.4, 23.5, 23.6_

- [ ] 13. Checkpoint — Verify admin dashboard
  - Ensure all tests pass, ask the user if questions arise.
  - Verify admin login/logout flow and session management
  - Verify article CRUD, user management, and credit settings work correctly


- [ ] 14. Credit API for external access
  - [x] 14.1 Implement API key authentication middleware
    - Create middleware that reads `X-API-Key` header, hashes it, and validates against `api_keys` table
    - Update `last_used_at` on successful authentication
    - Check `is_active` flag — reject inactive keys
    - Return HTTP 401 for missing or invalid keys
    - _Requirements: 18.2_

  - [ ]* 14.2 Write property test for API key authentication enforcement
    - **Property 15: API Key Authentication Enforcement**
    - **Validates: Requirements 18.2**

  - [x] 14.3 Implement Credit API endpoints
    - Create `GET /api/credit/balance/route.ts` — read balance by user_id or telegram_id query param
    - Create `GET /api/credit/history/route.ts` — transaction history by user_id
    - Create `POST /api/credit/spend/route.ts` — spend credit with atomic balance check (SELECT ... FOR UPDATE), validate sufficient balance, insert transaction, update balance
    - Return structured success/error responses matching design format
    - _Requirements: 18.1, 18.4, 18.5, 18.6_

  - [ ]* 14.4 Write property tests for credit system
    - **Property 12: Credit Balance Invariant**
    - **Property 13: Credit Finality After Deletion**
    - **Property 14: Credit Spend Balance Validation**
    - **Validates: Requirements 16.4, 16.5, 18.5, 18.6**

  - [x] 14.5 Implement rate limiting for Credit API
    - Apply rate limits: 100 requests/min per API key, 10 spend requests/min per API key
    - Add response headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
    - Return HTTP 429 with `Retry-After` header when limit exceeded
    - _Requirements: 18.7_

  - [x] 14.6 Implement CORS configuration for Credit API
    - Read `allowed_origins` from API key record
    - Set CORS headers to allow only registered domains
    - _Requirements: 18.8_

  - [x] 14.7 Implement Credit API activity logging
    - Log every external API request to activity_logs with actor_type "external_api"
    - Include API key used, endpoint accessed, response status, and IP address
    - _Requirements: 23.8_

- [ ] 15. Checkpoint — Verify Credit API
  - Ensure all tests pass, ask the user if questions arise.
  - Verify balance read, spend, and history endpoints work with API key auth
  - Verify rate limiting and CORS configuration


- [ ] 16. Performance optimization, error pages, and responsive polish
  - [x] 16.1 Implement performance optimizations
    - Configure Next.js Image component with WebP/AVIF auto-format, lazy loading, and responsive sizes
    - Implement code splitting with dynamic imports for heavy components (Lightbox, video player, ArticleEditor, Charts)
    - Implement skeleton loading placeholders (`SkeletonLoader.tsx`) matching page layouts for Feed, Gallery, and Article detail
    - Verify `font-display: swap` and font preloading are configured
    - Implement lazy loading for media in Gallery and Feed (load only viewport-visible items)
    - _Requirements: 19.2, 19.3, 19.5, 19.6, 19.7, 19.8_

  - [x] 16.2 Implement custom error pages
    - Create `app/not-found.tsx` (404) and `app/error.tsx` (500) with Bahasa Indonesia messages
    - Include clear explanation, cause, and suggested action for each error
    - Create `ErrorPage.tsx` reusable component for 400, 401, 403, 404, 500
    - Implement inline form validation errors in admin forms
    - Implement Toast notification component for async operation feedback
    - _Requirements: 24.2, 24.3_

  - [x] 16.3 Verify responsive design across breakpoints
    - Verify desktop (>1024px), tablet (768-1024px), and mobile (<768px) layouts
    - Verify hamburger menu works on mobile with overlay sidebar
    - Verify Gallery grid adapts correctly on all viewports
    - Verify article content is full-width and readable on mobile
    - Verify all interactive elements meet 44x44px minimum touch target
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 16.4 Implement public access without login
    - Verify all public pages (Feed, Article detail, Gallery, Outlook) are accessible without authentication
    - Ensure no login buttons, registration forms, or auth prompts appear on public pages
    - _Requirements: 25.1, 25.2_

- [ ] 17. Integration wiring and end-to-end verification
  - [x] 17.1 Wire bot service to frontend
    - Ensure articles created via Telegram Bot appear in frontend Feed and Gallery
    - Ensure media uploaded via bot is accessible from frontend pages
    - Verify credit transactions from bot are visible in admin dashboard
    - Verify activity logs from bot appear in admin log viewer
    - _Requirements: 15.5, 15.6_

  - [x] 17.2 Wire admin dashboard to bot REST API
    - Display bot status and command statistics in admin dashboard
    - Implement notification sending from admin dashboard via bot REST API
    - _Requirements: 15.4, 15.5_

  - [x] 17.3 Verify Outlook exclusivity
    - Confirm Outlook articles can only be created via admin dashboard
    - Confirm bot never creates articles with category "outlook"
    - Confirm Outlook articles appear on Outlook page and not in main Feed category tabs
    - _Requirements: 27.6, 27.7_

  - [x] 17.4 Verify credit finality
    - Confirm that deleting or hiding an article does not reduce the author's credit balance
    - Confirm earned credits persist after article status changes
    - _Requirements: 16.5_

  - [ ]* 17.5 Write integration tests for end-to-end flows
    - Test: Telegram message → article creation → feed display → like → comment
    - Test: Admin login → create article → edit → hide → verify hidden from feed
    - Test: External API key → read balance → spend credit → verify balance update
    - Test: Credit settings change → new article → verify new reward amount
    - _Requirements: 1.1, 5.3, 16.1, 18.5_

- [ ] 18. Final checkpoint — Full platform verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 27 requirements are covered by implementation
  - Verify Docker Compose deployment works end-to-end

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each major milestone
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- TypeScript is used across the entire stack (Next.js frontend + Node.js/Express bot service)
- All 22 correctness properties from the design document are covered by property test tasks
