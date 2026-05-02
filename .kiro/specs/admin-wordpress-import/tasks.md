# Tasks: Admin WordPress Import

## Task 1: Database Migration and Shared Types

Create the `wordpress_import_jobs` table and add shared TypeScript types.

- [x] 1.1 Create database migration file `db/migrations/007_create_wordpress_import_jobs.sql` with the `wordpress_import_jobs` table schema (id UUID PK, status VARCHAR(20) DEFAULT 'running', started_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ nullable, total_fetched INTEGER DEFAULT 0, total_imported INTEGER DEFAULT 0, total_skipped INTEGER DEFAULT 0, total_failed INTEGER DEFAULT 0, error_message TEXT nullable, triggered_by UUID FK to users). Include indexes on `status` and `started_at DESC`.
- [x] 1.2 Add `WordPressImportJob`, `ImportJobStatus`, `ImportCounts`, `WordPressPost`, and `ExtractedPost` type definitions to `shared/types/index.ts`.
- [x] 1.3 Add `IMPORT_ALREADY_RUNNING` to the `ErrorCode` registry in `shared/types/index.ts` and add the 409 HTTP status mapping in `ERROR_CODE_TO_HTTP_STATUS`.

## Task 2: Extract Shared Import Logic Module

Extract the pure functions and core import logic from `scripts/import-wordpress.js` into a shared TypeScript module that both the CLI script and the API route can consume.

- [x] 2.1 Create `shared/services/wordpressImport.ts` with `sanitizeWordPressHtml` and `extractPostData` functions ported from the CLI script, plus the `executeWordPressImport` orchestrator function that accepts `authorId`, `jobId`, and an `onProgress` callback. The orchestrator should fetch all WP posts (paginated), process each post (check slug, insert article + media), call `onProgress` after each post, and return final `ImportCounts`.
- [x] 2.2 Update `scripts/import-wordpress.js` to import `extractPostData` and `sanitizeWordPressHtml` from the shared module instead of defining them locally, ensuring the CLI script continues to work independently.

## Task 3: POST API Endpoint for Triggering Import

Create the `POST /api/wordpress-import` endpoint that triggers an import job.

- [x] 3.1 Create `frontend/src/app/api/wordpress-import/route.ts` with a `POST` handler that: validates admin session via `validateSession()`, checks for existing running jobs (returns 409 with `IMPORT_ALREADY_RUNNING` if found), creates a new `wordpress_import_jobs` record with `status='running'`, logs `wordpress_import_started` to `activity_logs` via `ActivityLogService`, starts the async import execution (fire-and-forget), and returns HTTP 202 with the job ID.
- [x] 3.2 Implement the async import execution within the POST handler: call `executeWordPressImport` with the admin's user ID as `authorId`, the job ID, and an `onProgress` callback that updates the job record counters in the database. On completion, update the job to `status='completed'` with `completed_at` and log `wordpress_import_completed`. On fatal error, update the job to `status='failed'` with `error_message` and log `wordpress_import_failed`.

## Task 4: GET API Endpoints for Import Status

Create the GET endpoints for retrieving import job history and individual job status.

- [x] 4.1 Add a `GET` handler to `frontend/src/app/api/wordpress-import/route.ts` that validates admin session and returns the 10 most recent import jobs ordered by `started_at DESC`, joined with the `users` table to include `triggered_by_username`.
- [x] 4.2 Create `frontend/src/app/api/wordpress-import/[id]/route.ts` with a `GET` handler that validates admin session and returns a single import job by ID (with `triggered_by_username`), returning 404 if not found.

## Task 5: ImportPanel UI Component

Create the ImportPanel component for the admin blog page.

- [x] 5.1 Create `frontend/src/components/admin/ImportPanel.tsx` and `frontend/src/components/admin/ImportPanel.module.css`. The component should: fetch the latest import job on mount, display an "Impor dari WordPress" button, show a confirmation dialog with the message "Mulai impor artikel dari WordPress? Artikel dengan slug yang sudah ada akan dilewati." before triggering import, and accept an `onImportComplete` callback prop.
- [x] 5.2 Implement the polling logic in ImportPanel: after triggering an import, poll `GET /api/wordpress-import/[id]` every 2 seconds, display progress counts (fetched, imported, skipped, failed), disable the import button while running, stop polling when status becomes `completed` or `failed`, and display the final result (success summary or error message). All UI text in Indonesian.
- [x] 5.3 Integrate ImportPanel into the admin blog page (`frontend/src/app/admin/(dashboard)/blog/page.tsx`): import and render ImportPanel above the existing DataTable, pass a callback that triggers article list refresh on import completion. Export ImportPanel from `frontend/src/components/admin/index.ts`.

## Task 6: Property-Based Tests

Write property-based tests for the correctness properties defined in the design document using `fast-check`.

- [x] 6.1 Install `fast-check` as a dev dependency in the appropriate package. Create the test file for property tests.
  - [x] 6.1.1 ✅ PBT: Property 1 — HTML sanitization idempotence: *For any* HTML string, `sanitizeWordPressHtml(sanitizeWordPressHtml(html))` equals `sanitizeWordPressHtml(html)`. Generate arbitrary HTML strings including `<img>` tags with various `src`, `data-src`, `data-srcset`, `data-sizes`, and `class="lazyload"` attribute combinations. Min 100 iterations. Tag: `Feature: admin-wordpress-import, Property 1: HTML sanitization is idempotent`
  - [x] 6.1.2 ✅ PBT: Property 2 — Post data extraction preserves source fields: *For any* valid WordPress post object, `extractPostData(post).title` equals `post.title.rendered`, `.slug` equals `post.slug`, `.date` equals `post.date`, and `.featuredImageUrl` equals the embedded media URL or null. Generate arbitrary WP post objects. Min 100 iterations. Tag: `Feature: admin-wordpress-import, Property 2: Post data extraction preserves source fields`
  - [x] 6.1.3 ✅ PBT: Property 3 — Import job accounting invariant: *For any* set of WordPress posts processed by the import logic, `total_imported + total_skipped + total_failed` equals `total_fetched`. Use mocked DB and WP API. Min 100 iterations. Tag: `Feature: admin-wordpress-import, Property 3: Import job accounting invariant`
  - [x] 6.1.4 ✅ PBT: Property 4 — API-imported articles use correct metadata: *For any* WordPress post imported via the shared import logic, the resulting article has `category='blog'`, `source='wordpress'`, and `author_id` matching the provided admin ID. Use mocked DB. Min 100 iterations. Tag: `Feature: admin-wordpress-import, Property 4: API-imported articles use correct metadata`
