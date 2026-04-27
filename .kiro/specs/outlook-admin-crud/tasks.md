# Implementation Plan: Outlook Admin CRUD

## Overview

Build dedicated admin pages for managing Outlook (market analysis) articles — a listing page, edit page, and inline actions (delete, status toggle) — all reusing existing API routes with `category=outlook` filtering. The implementation follows the established articles admin pattern with DataTable, CSS modules, and the enhanced OutlookEditor component.

## Tasks

- [x] 1. Enhance OutlookEditor with initialData prop support
  - [x] 1.1 Add `initialData` and related props to OutlookEditor component
    - Add `OutlookInitialData` interface with `title`, `content_html`, and `status` fields
    - Add optional `initialData?: OutlookInitialData` prop to `OutlookEditorProps`
    - Initialize `title` state from `initialData?.title ?? ''`
    - Initialize `contentHtml` state from `initialData?.content_html ?? ''`
    - Initialize `status` state from `initialData?.status ?? 'published'`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.2 Export OutlookInitialData type from admin components index
    - Add `export type { OutlookInitialData }` to `frontend/src/components/admin/index.ts`
    - _Requirements: 6.4_

  - [ ]* 1.3 Write property test for OutlookEditor initialData pre-population
    - **Property 1: OutlookEditor initialData pre-population**
    - Use `fast-check` to generate random `{ title: string, content_html: string, status: 'published' | 'hidden' | 'draft' }` objects
    - Render OutlookEditor with generated `initialData` and assert each field's initial value matches the input
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 2.2**

- [x] 2. Create Outlook CSS module
  - [x] 2.1 Create `outlook.module.css` with styles matching articles pattern
    - Create `frontend/src/app/admin/(dashboard)/outlook/outlook.module.css`
    - Replicate the same class names and styles from `articles/articles.module.css` (titleCell, titleLink, noTitle, slug, actions, actionBtn, actionBtnDanger, pageHeader, backLink, editorCard)
    - _Requirements: 1.2, 2.1_

- [x] 3. Implement Outlook listing page
  - [x] 3.1 Create the Outlook listing page component
    - Create `frontend/src/app/admin/(dashboard)/outlook/page.tsx` as a `'use client'` component
    - Implement state for `articles`, `total`, `page`, `search`, `statusFilter`, `loading`
    - Fetch articles from `GET /api/articles?category=outlook` with hardcoded `category=outlook` param
    - Append `search`, `status`, `page`, `pageSize=20` params dynamically
    - Import and use `DataTable` and `StatusBadge` from `@/components/admin`
    - Import styles from `./outlook.module.css`
    - _Requirements: 1.1, 1.6_

  - [x] 3.2 Define DataTable columns for the Outlook listing
    - Title column: link to `/admin/outlook/[id]/edit`, fallback "Tanpa judul" for null titles
    - Status column: render `StatusBadge` component
    - Author column: display `author_username` or "—"
    - Media column: display `📎 {count}` or "—"
    - Date column: formatted with `id-ID` locale
    - Actions column: Edit ✏️, Toggle 👁️/🔓, Delete 🗑️ buttons
    - _Requirements: 1.2, 5.1, 5.2, 5.3_

  - [x] 3.3 Implement search and status filter
    - Wire search input to `onSearchChange` callback, reset page to 1 on change
    - Add status filter with options: Semua Status, Published, Hidden, Draft
    - No category filter (all items are outlook)
    - _Requirements: 1.3, 1.4_

  - [x] 3.4 Implement status toggle action
    - Toggle `published` → `hidden`, `hidden`/`draft` → `published`
    - Send `PUT /api/articles/[id]` with `{ status: newStatus }`
    - Re-fetch article list on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.5 Implement delete action
    - Show `confirm()` dialog with article title before deleting
    - Send `DELETE /api/articles/[id]` on confirmation
    - Re-fetch article list on success
    - Display error notification on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.6 Add "New Outlook" button and empty state
    - Add toolbar action button linking to `/admin/outlook/new`
    - Set empty message to indicate no Outlook articles are available
    - _Requirements: 1.5, 1.7_

  - [ ]* 3.7 Write property test for status toggle correctness
    - **Property 2: Status toggle correctness**
    - Use `fast-check` to generate random status values from `{'published', 'hidden', 'draft'}`
    - Assert: `published` → `hidden`, everything else → `published`
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 3.8 Write unit tests for Outlook listing page
    - Test that DataTable renders with correct columns
    - Test that API is called with `category=outlook`
    - Test that "New Outlook" button links to `/admin/outlook/new`
    - Test empty state message when no articles exist
    - Test status filter options (all, published, hidden, draft)
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.7_

- [x] 4. Checkpoint - Ensure listing page works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Outlook edit page
  - [x] 5.1 Create the Outlook edit page component
    - Create `frontend/src/app/admin/(dashboard)/outlook/[id]/edit/page.tsx` as a `'use client'` component
    - Extract `id` from route params via `useParams()`
    - Fetch article data from `GET /api/articles/[id]` on mount
    - Handle loading, error, and not-found states
    - Display "Artikel tidak ditemukan" for 404, "Gagal memuat artikel" for fetch errors
    - Import styles from `../../../outlook/outlook.module.css` (or appropriate relative path)
    - _Requirements: 2.1, 2.5_

  - [x] 5.2 Wire OutlookEditor with initialData for edit mode
    - Pass loaded article data as `initialData` prop: `{ title, content_html, status }`
    - Set `submitLabel` to "Simpan Perubahan"
    - Pass `onCancel` handler that navigates to `/admin/outlook`
    - Use dynamic import for OutlookEditor (matching the pattern from `outlook/new/page.tsx`)
    - _Requirements: 2.1, 2.2, 6.1, 6.2, 6.3_

  - [x] 5.3 Implement edit form submission with image upload
    - On submit: iterate inline images, upload each via `POST /api/media/upload`
    - Replace blob URLs in content_html with returned file URLs
    - Send `PUT /api/articles/[id]` with updated `{ title, content_html, category: 'outlook', status }`
    - On success: redirect to `/admin/outlook`
    - On error: display error message, preserve form state (reset submitting flag, no redirect)
    - _Requirements: 2.3, 2.4, 2.6, 2.7_

  - [ ]* 5.4 Write unit tests for Outlook edit page
    - Test error display when article not found (404)
    - Test form state preservation on save error
    - Test redirect to `/admin/outlook` on successful save
    - Test that OutlookEditor receives correct initialData
    - _Requirements: 2.1, 2.5, 2.6, 2.7_

- [x] 6. Update existing Outlook new page redirects
  - [x] 6.1 Update `outlook/new/page.tsx` to redirect to `/admin/outlook` instead of `/admin/articles`
    - Change the success redirect from `router.push('/admin/articles')` to `router.push('/admin/outlook')`
    - Change the back link from `/admin/articles` to `/admin/outlook`
    - Change the cancel handler from `/admin/articles` to `/admin/outlook`
    - Import styles from `../outlook.module.css` instead of articles module (if appropriate)
    - _Requirements: 1.5, 5.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- No new backend API routes are needed — all operations use existing `/api/articles` endpoints with `category=outlook` filtering
- The OutlookEditor enhancement (task 1) is a prerequisite for the edit page (task 5)
- Property tests validate universal correctness properties from the design document
- The existing `outlook/new/page.tsx` needs redirect updates (task 6) to point to the new Outlook listing instead of the general articles page
