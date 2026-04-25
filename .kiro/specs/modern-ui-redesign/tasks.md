# Implementation Plan: Modern UI Redesign

## Overview

Transform the Horizon Trader Platform from a retro blogger aesthetic to a modern dark/light dual-theme UI. The implementation uses CSS custom properties scoped to `[data-theme="dark"]` and `[data-theme="light"]` on the `<html>` element, a new ThemeToggle client component, and an inline blocking script for flash-free theme initialization. All changes are presentation-layer only — no database, API, or routing modifications.

## Tasks

- [x] 1. Restructure globals.css with theme-aware token system
  - [x] 1.1 Replace `:root` color tokens with `[data-theme="dark"]` and `[data-theme="light"]` scoped CSS custom properties
    - Define dark theme tokens: `--color-bg` (#0a0a0a), `--color-surface` (#141414), `--color-text` (#f1f1f1), `--color-text-muted` (#a1a1a1), `--color-border` (#1f1f1f), `--color-accent` (#10b981)
    - Define light theme tokens: `--color-bg` (#fafafa), `--color-surface` (#f0f0f0), `--color-text` (#1a1a1a), `--color-text-muted` (#6b7280), `--color-border` (#d1d5db), `--color-accent` (#10b981)
    - Define shared utility colors: `--color-danger` (#ef4444), `--color-warning` (#f59e0b), `--color-info` (#3b82f6)
    - Define theme-scoped shadow tokens (dark: higher opacity rgba, light: lower opacity rgba) and emerald glow shadow
    - Keep non-color tokens (spacing, font sizes, layout, font families) in `:root` since they don't change per theme
    - Update `--border-radius` from `2px` to `10px` and `--border-width` from `2px` to `1px`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 13.1, 13.2, 13.3, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 18.8_
  - [x] 1.2 Update global base styles to use new theme tokens
    - Update `body` to use `var(--color-bg)` background and `var(--color-text)` color
    - Update heading styles (h1–h6): remove `text-transform: uppercase`, remove `background-color` fills, remove `border-bottom` decorations, use `var(--color-text)` color, set h1 to `font-size: 2rem; font-weight: 700`, h2 to `font-size: 1.75rem; font-weight: 600`
    - Update link styles: `var(--color-accent)` color, no underline by default, underline on hover
    - Update `code` element to use `var(--color-surface)` background and `var(--color-border)` border
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 1.3 Remove retro utility classes and update global element styles
    - Remove `.retro-box`, `.retro-box-accent`, and `.retro-divider` class definitions
    - Update table styles: replace emerald `th` background with `var(--color-surface)`, replace cream alternating rows with subtle `var(--color-surface)` striping, use `var(--color-border)` for table borders
    - Update scrollbar styles: `var(--color-bg)` track, muted dark thumb
    - Update `::selection` to use `var(--color-accent)` background with white text
    - Update `.skip-to-content` to use `var(--color-accent)` background with white text
    - Update button base styles (`.btn-primary`, `.btn-secondary`) and form element styles (`input`, `textarea`, `select`) to use theme tokens with emerald focus glow
    - Update `border-radius` to `6px–8px` for buttons and form inputs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 15.2, 15.3_

- [x] 2. Create theme initialization script and update root layout
  - [x] 2.1 Create the theme initialization script module
    - Create `frontend/src/lib/theme-init.ts` exporting a `themeInitScript` string constant
    - The script reads `localStorage.getItem('horizon-theme')`, validates the value is `"dark"` or `"light"`, and sets `document.documentElement.setAttribute('data-theme', ...)` — defaulting to `"dark"` if no valid value found
    - Wrap `localStorage` access in try/catch for private browsing compatibility
    - _Requirements: 18.4, 18.5, 18.6, 18.7_
  - [x] 2.2 Update root layout to inject theme init script and set default data-theme
    - Modify `frontend/src/app/layout.tsx`: add `data-theme="dark"` attribute on the `<html>` element
    - Import `themeInitScript` from `@/lib/theme-init` and inject as `<script dangerouslySetInnerHTML>` before body content to prevent flash of wrong theme
    - _Requirements: 18.5, 18.6, 18.7, 18.8_

- [x] 3. Create ThemeToggle component
  - [x] 3.1 Create ThemeToggle client component and its CSS module
    - Create `frontend/src/components/ui/ThemeToggle.tsx` as a `'use client'` component
    - Implement toggle logic: read current theme from `document.documentElement.getAttribute('data-theme')`, toggle between `"dark"` and `"light"`, update DOM attribute, persist to `localStorage` with try/catch
    - Render sun SVG icon when dark mode active (click to switch to light), moon SVG icon when light mode active (click to switch to dark)
    - Use `useState` + `useEffect` to sync with DOM on mount (avoid SSR mismatch)
    - Create `frontend/src/components/ui/ThemeToggle.module.css` with 44×44px minimum touch target, icon rotation/opacity transition (0.3s), and theme-aware styling
    - _Requirements: 18.1, 18.3, 18.4, 18.7, 18.9, 18.10_
  - [x] 3.2 Integrate ThemeToggle into Navbar and MobileMenu
    - Import and render `<ThemeToggle />` in `frontend/src/components/layout/Navbar.tsx` between nav links and mobile menu trigger
    - Import and render `<ThemeToggle />` in `frontend/src/components/layout/MobileMenu.tsx` in the panel header area
    - _Requirements: 18.1, 18.2_

- [x] 4. Checkpoint — Verify theme foundation
  - Ensure the app builds without errors (`npm run build` in `frontend/`)
  - Verify `data-theme` attribute is set on `<html>`, theme toggle switches between dark/light, and `localStorage` persists the preference
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update layout component CSS modules (Navbar, Footer, Sidebar, MobileMenu)
  - [x] 5.1 Update Navbar CSS module
    - Modify `frontend/src/components/layout/Navbar.module.css`: dark surface background (`var(--color-bg)` or slightly lighter), subtle 1px bottom border with `var(--color-border)`, emerald logo color, muted nav links with hover transition to `var(--color-text)` or `var(--color-accent)`
    - Maintain sticky positioning, z-index 100, and 44×44px touch targets
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 5.2 Update Footer CSS module
    - Modify `frontend/src/components/layout/Footer.module.css`: `var(--color-bg)` background, top border with `var(--color-border)`, emerald brand text, muted links with hover to `var(--color-text)`, copyright in muted at 0.875rem
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 5.3 Update Sidebar CSS module and remove retro class references
    - Modify `frontend/src/components/layout/Sidebar.module.css`: `var(--color-surface)` panel backgrounds, 1px solid borders with `var(--color-border)`, border-radius 10px, section titles in `var(--color-text)` without uppercase, category links in muted with emerald hover, community stat icons in muted with emerald highlights
    - Remove any `.retro-box` or `.retro-box-accent` class usage from `Sidebar.tsx` if present
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 12.1, 12.2_
  - [x] 5.4 Update MobileMenu CSS module
    - Modify `frontend/src/components/layout/MobileMenu.module.css`: `var(--color-surface)` panel background, semi-transparent black backdrop (rgba(0,0,0,0.6)), emerald logo, primary text section titles, muted nav links with emerald hover, hamburger icon lines in `var(--color-text)`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 6. Update feed component CSS modules (ArticleCard, ArticleLongCard, CategoryTabs, FeedList)
  - [x] 6.1 Update ArticleCard CSS module
    - Modify `frontend/src/components/feed/ArticleCard.module.css`: `var(--color-surface)` background, 1px solid `var(--color-border)`, border-radius 10px, emerald hover glow border transition, emerald category badge on semi-transparent emerald bg, title in `var(--color-text)`, excerpt in `var(--color-text-muted)`, replace dashed separators with solid subtle borders
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 6.2 Update ArticleLongCard CSS module
    - Modify `frontend/src/components/feed/ArticleLongCard.module.css`: apply same dark card conventions as ArticleCard
    - _Requirements: 4.9_
  - [x] 6.3 Update CategoryTabs CSS module
    - Modify `frontend/src/components/feed/CategoryTabs.module.css`: transparent/`var(--color-bg)` base for inactive tabs with muted text, emerald active tab with bottom border or background highlight, hover transition toward `var(--color-text)`, 44×44px touch targets
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 6.4 Update FeedList CSS module
    - Modify `frontend/src/components/feed/FeedList.module.css`: ensure layout container uses `var(--color-bg)` background and any text uses theme tokens
    - _Requirements: 1.1, 14.5_

- [x] 7. Update gallery component CSS modules (GalleryGrid, GalleryItem, Lightbox)
  - [x] 7.1 Update GalleryGrid and GalleryItem CSS modules
    - Modify `frontend/src/components/gallery/GalleryGrid.module.css`: `var(--color-surface)` empty state background, muted empty state text
    - Modify `frontend/src/components/gallery/GalleryItem.module.css`: `var(--color-surface)` background, subtle borders, border-radius 10px, emerald hover border transition or scale/shadow effect
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 7.2 Update Lightbox CSS module
    - Modify `frontend/src/components/gallery/Lightbox.module.css`: dark overlay backdrop (rgba(0,0,0,0.85)), close button in `var(--color-text)` with emerald hover, caption in `var(--color-text)` on semi-transparent dark background
    - _Requirements: 9.5, 9.6, 9.7_

- [x] 8. Update outlook and article detail component CSS modules
  - [x] 8.1 Update OutlookCard CSS module
    - Modify `frontend/src/components/outlook/OutlookCard.module.css`: `var(--color-surface)` background, subtle borders, emerald "Outlook" badge consistent with category badges
    - _Requirements: 4.7, 4.8_
  - [x] 8.2 Update OutlookContent CSS module
    - Modify `frontend/src/components/outlook/OutlookContent.module.css`: ensure article content area uses theme tokens for backgrounds, text, and borders
    - _Requirements: 1.1, 1.2_
  - [x] 8.3 Update ArticleContent and ArticleMeta CSS modules
    - Modify `frontend/src/components/article/ArticleContent.module.css`: theme-aware prose styling with `var(--color-text)`, `var(--color-text-muted)`, `var(--color-surface)` code blocks
    - Modify `frontend/src/components/article/ArticleMeta.module.css`: muted metadata text, emerald accent links
    - _Requirements: 2.1, 2.5, 2.6_
  - [x] 8.4 Update CommentSection, LikeButton, and ShareButtons CSS modules
    - Modify `frontend/src/components/article/CommentSection.module.css`: theme-aware comment cards, form inputs, and borders
    - Modify `frontend/src/components/article/LikeButton.module.css`: theme-aware button styling with emerald active state
    - Modify `frontend/src/components/article/ShareButtons.module.css`: theme-aware share button styling
    - _Requirements: 10.1, 10.3, 10.4_

- [x] 9. Update UI utility component CSS modules (Pagination, SkeletonLoader, ErrorPage, Toast)
  - [x] 9.1 Update Pagination CSS module
    - Modify `frontend/src/components/ui/Pagination.module.css`: `var(--color-surface)` page buttons, muted text, emerald active button with white text, solid borders
    - _Requirements: 11.1_
  - [x] 9.2 Update SkeletonLoader CSS module
    - Modify `frontend/src/components/ui/SkeletonLoader.module.css`: dark shimmer animation using `var(--color-surface)` to slightly lighter shade (#222–#2a2a2a range for dark, light equivalents for light theme)
    - _Requirements: 11.2_
  - [x] 9.3 Update ErrorPage CSS module
    - Modify `frontend/src/components/ui/ErrorPage.module.css`: `var(--color-surface)` card background, emerald error code, `var(--color-text)` title, `var(--color-text-muted)` description
    - _Requirements: 11.3_
  - [x] 9.4 Update Toast CSS module
    - Modify `frontend/src/components/ui/Toast.module.css`: `var(--color-surface)` background, left border accent in emerald (success), danger (error), or warning (warning)
    - _Requirements: 11.4_

- [x] 10. Checkpoint — Verify public-facing theme
  - Ensure the app builds without errors
  - Verify all public pages (Feed, Article detail, Gallery, Outlook) render correctly in both dark and light themes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update admin dashboard theme
  - [x] 11.1 Update admin layout CSS module
    - Modify `frontend/src/app/admin/(dashboard)/layout.module.css`: `var(--color-bg)` for admin layout background, `var(--color-surface)` for sidebar background (replacing `var(--color-slate)`), theme-aware borders, emerald active nav link accent, `var(--color-surface)` top bar, theme-aware logout button and admin info styling
    - _Requirements: 16.1_
  - [x] 11.2 Update admin login page CSS module
    - Modify `frontend/src/app/admin/login/page.module.css`: `var(--color-bg)` page background, `var(--color-surface)` login card, remove uppercase text-transform and emerald background from login title, theme-aware form inputs and submit button, theme-aware error message styling
    - _Requirements: 16.6_
  - [x] 11.3 Update admin component CSS modules (DataTable, StatsCards, Charts)
    - Modify `frontend/src/components/admin/DataTable.module.css`: `var(--color-surface)` header rows, `var(--color-bg)` body rows, subtle border separators
    - Modify `frontend/src/components/admin/StatsCards.module.css`: `var(--color-surface)` card backgrounds, emerald highlights for key metrics
    - Modify `frontend/src/components/admin/Charts.module.css`: emerald primary data color, `var(--color-bg)` chart areas
    - _Requirements: 16.2, 16.3, 16.4_
  - [x] 11.4 Update admin editor and settings CSS modules
    - Modify `frontend/src/components/admin/ArticleEditor.module.css`: theme-aware form styling per Requirement 10
    - Modify `frontend/src/components/admin/OutlookEditor.module.css`: theme-aware form styling per Requirement 10
    - Modify `frontend/src/components/admin/CreditSettings.module.css`: theme-aware form styling per Requirement 10
    - _Requirements: 16.5_
  - [x] 11.5 Update remaining admin component CSS modules
    - Modify `frontend/src/components/admin/LogViewer.module.css`: theme-aware log display with `var(--color-surface)` background and monospace text in `var(--color-text)`
    - Modify `frontend/src/components/admin/BotStatus.module.css`: theme-aware status indicators
    - Modify `frontend/src/components/admin/UserProfile.module.css`: theme-aware profile card styling
    - _Requirements: 16.1, 16.5_

- [x] 12. Update admin page-specific CSS modules
  - [x] 12.1 Update admin page CSS modules
    - Modify `frontend/src/app/admin/(dashboard)/articles/articles.module.css`: theme-aware article management styles
    - Modify `frontend/src/app/admin/(dashboard)/comments/comments.module.css`: theme-aware comment management styles
    - Modify `frontend/src/app/admin/(dashboard)/users/users.module.css`: theme-aware user management styles
    - Modify `frontend/src/app/admin/(dashboard)/api-keys/api-keys.module.css`: theme-aware API key management styles
    - _Requirements: 16.1, 16.2, 16.5, 17.9_

- [x] 13. Final checkpoint — Full build and verification
  - Run `npm run build` in `frontend/` to ensure zero build errors
  - Run `npm run lint` to ensure no linting issues
  - Verify both dark and light themes render correctly across all pages (Feed, Article, Gallery, Outlook, Admin Dashboard, Admin Login)
  - Verify responsive breakpoints (768px, 1024px) work in both themes
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 14. Write unit tests for ThemeToggle and theme initialization
  - [ ]* 14.1 Set up test framework if not already configured
    - Install `vitest` and `@testing-library/react` as dev dependencies
    - Create vitest config for Next.js + React 19
    - _Requirements: 18.3, 18.4_
  - [ ]* 14.2 Write unit tests for ThemeToggle component
    - Test: renders without crashing
    - Test: displays sun icon when `data-theme="dark"` is active
    - Test: displays moon icon when `data-theme="light"` is active
    - Test: clicking toggles `data-theme` attribute on `<html>`
    - Test: clicking persists new theme to `localStorage`
    - Test: handles `localStorage` unavailability gracefully (no throw)
    - Test: has minimum 44×44px touch target
    - _Requirements: 18.1, 18.3, 18.4, 18.9, 18.10_
  - [ ]* 14.3 Write unit tests for theme initialization script
    - Test: sets `data-theme="dark"` when no `localStorage` value exists
    - Test: sets `data-theme="dark"` when `localStorage` has `"dark"`
    - Test: sets `data-theme="light"` when `localStorage` has `"light"`
    - Test: defaults to `"dark"` when `localStorage` has an invalid value
    - _Requirements: 18.5, 18.6, 18.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major milestones
- The design has no Correctness Properties section, so property-based tests are not applicable — unit tests cover the ThemeToggle and theme init logic
- All CSS module changes use the same theme token names (`var(--color-bg)`, `var(--color-surface)`, etc.) so components automatically adapt to both dark and light themes
- No new dependencies are needed for the core implementation; `vitest` and `@testing-library/react` are only needed for optional test tasks
