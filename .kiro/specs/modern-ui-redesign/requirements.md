# Requirements Document

## Introduction

The Horizon Trader Platform frontend is being redesigned from a retro blogger aesthetic (light backgrounds, boxy headers, dashed borders, uppercase headings with emerald background fills) to a modern UI/UX inspired by horizonfx.id. The redesign supports both dark and light themes with a user-togglable theme switcher, defaulting to dark mode. Both themes use emerald green accents, clean card-based layouts, modern typography, and a professional trading community look. All existing functionality, pages (Feed, Article detail, Gallery, Outlook, Admin), and responsive behavior are preserved. Only the visual presentation layer changes.

## Glossary

- **Theme_System**: The CSS custom properties (design tokens) defined in `globals.css` that control colors, typography, spacing, shadows, and border styles across the entire application.
- **Navbar**: The sticky top navigation bar component (`Navbar.tsx`) containing the logo, navigation links, and mobile menu trigger.
- **Footer**: The bottom section component (`Footer.tsx`) displaying brand info, navigation links, and copyright.
- **Sidebar**: The aside component (`Sidebar.tsx`) showing categories, community info, and external links on the Feed page.
- **MobileMenu**: The slide-out overlay navigation component (`MobileMenu.tsx`) for mobile viewports.
- **ArticleCard**: The card component (`ArticleCard.tsx`) displaying article previews in the Feed.
- **ArticleLongCard**: The extended card component (`ArticleLongCard.tsx`) for longer article previews.
- **OutlookCard**: The card component (`OutlookCard.tsx`) for market outlook article previews with cover images.
- **CategoryTabs**: The tab-based filter component (`CategoryTabs.tsx`) for filtering articles by category.
- **GalleryGrid**: The responsive grid component (`GalleryGrid.tsx`) displaying media items with infinite scroll.
- **GalleryItem**: The individual media thumbnail component within the gallery grid.
- **Lightbox**: The full-screen modal overlay (`Lightbox.tsx`) for viewing gallery media at full size.
- **Pagination**: The page navigation component (`Pagination.tsx`) for paginated content.
- **SkeletonLoader**: The loading placeholder component (`SkeletonLoader.tsx`) that prevents layout shift during content loading.
- **ErrorPage**: The reusable error display component (`ErrorPage.tsx`) for HTTP error codes.
- **Toast**: The notification component (`Toast.tsx`) for transient user feedback messages.
- **Dark_Background**: A very dark base color (#0a0a0a or similar) used as the primary page background.
- **Surface_Color**: A slightly lighter dark color (#111111 to #1a1a1a) used for cards, panels, and elevated UI elements.
- **Emerald_Accent**: The green accent color (#10b981 or similar) used for branding, interactive elements, and highlights.
- **WCAG_AA**: Web Content Accessibility Guidelines level AA, requiring a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text.
- **Admin_Dashboard**: The protected admin area (`/admin`) with its own layout shell, header, sidebar, and dashboard widgets.
- **ThemeToggle**: A UI button component that switches between dark and light themes, persisting the user's preference.
- **Light_Background**: A light base color (#ffffff or #fafafa) used as the primary page background in light mode.
- **Light_Surface**: A slightly off-white color (#f5f5f5 to #f0f0f0) used for cards, panels, and elevated elements in light mode.
- **Light_Text**: A dark text color (#111111 to #1a1a1a) used for body text in light mode.
- **Light_Muted**: A medium gray (#6b7280 to #9ca3af) used for secondary text in light mode.
- **Light_Border**: A light gray (#e5e7eb to #d1d5db) used for borders in light mode.

## Requirements

### Requirement 1: Dark Theme Color System

**User Story:** As a platform visitor, I want the interface to use a modern dark color scheme, so that the platform looks professional and is comfortable to read during extended sessions.

#### Acceptance Criteria

1. THE Theme_System SHALL define a Dark_Background color token with a value in the range #0a0a0a to #0f0f0f for the primary page background in dark mode.
2. THE Theme_System SHALL define a Surface_Color token with a value in the range #111111 to #1a1a1a for cards, panels, and elevated elements in dark mode.
3. THE Theme_System SHALL define an Emerald_Accent token (#10b981 or equivalent) for branding, links, active states, and interactive highlights in both themes.
4. THE Theme_System SHALL define a primary text color of #f1f1f1 or lighter for body text on Dark_Background in dark mode.
5. THE Theme_System SHALL define a muted text color in the range #888888 to #a1a1a1 for secondary and metadata text in dark mode.
6. THE Theme_System SHALL define a border color in the range #1f1f1f to #2a2a2a for subtle card and section borders in dark mode.
7. THE Theme_System SHALL define danger (#ef4444), warning (#f59e0b), and info (#3b82f6) utility colors that meet WCAG_AA contrast on both Dark_Background and Light_Background.
8. THE Theme_System SHALL remove all retro-theme tokens (--color-offwhite, --color-cream, --color-emerald-muted as light green) and replace references with theme-aware equivalents.

### Requirement 2: Typography Modernization

**User Story:** As a platform visitor, I want clean modern typography without retro styling, so that content is easy to read and the platform feels contemporary.

#### Acceptance Criteria

1. THE Theme_System SHALL use Inter as the primary font family for both body text and headings.
2. THE Theme_System SHALL render headings (h1–h6) without uppercase text-transform, without background-color fills, and without border-bottom decorations.
3. THE Theme_System SHALL render h1 elements with a font-size between 1.875rem and 2.25rem, font-weight 700, and the primary text color.
4. THE Theme_System SHALL render h2 elements with a font-size between 1.5rem and 1.875rem and font-weight 600.
5. THE Theme_System SHALL render body text at 1rem with a line-height between 1.5 and 1.7.
6. THE Theme_System SHALL render links with Emerald_Accent color, no underline by default, and underline on hover.

### Requirement 3: Navbar Redesign

**User Story:** As a platform visitor, I want a sleek dark navigation bar, so that I can navigate the platform with a modern and professional header.

#### Acceptance Criteria

1. THE Navbar SHALL use Dark_Background or a slightly lighter dark surface (#111111 to #141414) as its background color.
2. THE Navbar SHALL display a subtle bottom border using the defined border color token (1px solid).
3. THE Navbar SHALL display the "Horizon" logo text in Emerald_Accent color with font-weight 700.
4. THE Navbar SHALL display navigation links in the muted text color, transitioning to primary text color or Emerald_Accent on hover.
5. THE Navbar SHALL maintain sticky positioning at the top of the viewport with z-index 100.
6. THE Navbar SHALL maintain a minimum touch target of 44x44 pixels for all interactive elements.

### Requirement 4: Card Component Redesign

**User Story:** As a platform visitor, I want article and outlook cards with a modern dark appearance, so that content previews look clean and professional.

#### Acceptance Criteria

1. THE ArticleCard SHALL use Surface_Color as its background with a 1px solid border using the border color token.
2. THE ArticleCard SHALL apply a border-radius between 8px and 12px.
3. WHEN a user hovers over the ArticleCard, THE ArticleCard SHALL transition the border color to Emerald_Accent with a subtle glow or elevated shadow effect.
4. THE ArticleCard SHALL display the category badge with Emerald_Accent text on a semi-transparent emerald background (rgba-based).
5. THE ArticleCard SHALL display the title in primary text color and the excerpt in muted text color.
6. THE ArticleCard SHALL replace dashed border separators with solid subtle borders or spacing-based separation.
7. THE OutlookCard SHALL follow the same dark card styling as the ArticleCard with Surface_Color background and subtle borders.
8. THE OutlookCard SHALL display the "Outlook" badge with Emerald_Accent styling consistent with category badges.
9. THE ArticleLongCard SHALL follow the same dark card styling conventions as the ArticleCard.

### Requirement 5: Sidebar Redesign

**User Story:** As a platform visitor, I want the sidebar to match the dark theme, so that the page layout is visually cohesive.

#### Acceptance Criteria

1. THE Sidebar SHALL use Surface_Color as the background for each section panel.
2. THE Sidebar SHALL apply 1px solid borders using the border color token and border-radius between 8px and 12px.
3. THE Sidebar SHALL display section titles (h3) in primary text color without uppercase text-transform.
4. THE Sidebar SHALL display category links in muted text color, transitioning to Emerald_Accent on hover.
5. THE Sidebar SHALL remove all retro-box and retro-box-accent CSS class usage and replace with dark-themed equivalents.
6. THE Sidebar SHALL display community stat icons and labels in muted text color with Emerald_Accent icon highlights.

### Requirement 6: Footer Redesign

**User Story:** As a platform visitor, I want the footer to match the dark theme, so that the bottom of every page is visually consistent.

#### Acceptance Criteria

1. THE Footer SHALL use Dark_Background or a slightly darker variant as its background color.
2. THE Footer SHALL display a top border using the border color token to separate it from page content.
3. THE Footer SHALL display the "Horizon" brand text in Emerald_Accent color.
4. THE Footer SHALL display the tagline and navigation links in muted text color, transitioning to primary text color on hover.
5. THE Footer SHALL display the copyright text in muted text color at a reduced font-size (0.875rem or smaller).

### Requirement 7: MobileMenu Redesign

**User Story:** As a mobile user, I want the slide-out menu to use the dark theme, so that the mobile navigation experience is consistent with the desktop design.

#### Acceptance Criteria

1. THE MobileMenu panel SHALL use Surface_Color as its background.
2. THE MobileMenu backdrop SHALL use a semi-transparent black overlay (rgba(0, 0, 0, 0.6) or darker).
3. THE MobileMenu SHALL display the "Horizon" logo in Emerald_Accent color.
4. THE MobileMenu SHALL display section titles in primary text color and navigation links in muted text color.
5. WHEN a user hovers or focuses on a navigation link, THE MobileMenu SHALL transition the link color to Emerald_Accent.
6. THE MobileMenu hamburger icon lines SHALL use primary text color (#f1f1f1 or lighter).

### Requirement 8: CategoryTabs Redesign

**User Story:** As a platform visitor, I want the category filter tabs to match the dark theme, so that filtering articles feels integrated with the overall design.

#### Acceptance Criteria

1. THE CategoryTabs SHALL display inactive tabs with muted text color on a transparent or Dark_Background base.
2. WHEN a tab is active, THE CategoryTabs SHALL display the active tab with Emerald_Accent text and a bottom border or background highlight in Emerald_Accent.
3. WHEN a user hovers over an inactive tab, THE CategoryTabs SHALL transition the tab text color toward primary text color.
4. THE CategoryTabs SHALL maintain a minimum touch target of 44x44 pixels for each tab button.

### Requirement 9: Gallery and Lightbox Redesign

**User Story:** As a platform visitor, I want the gallery and lightbox to use the dark theme, so that media viewing is immersive and visually consistent.

#### Acceptance Criteria

1. THE GalleryGrid SHALL display gallery items with Surface_Color backgrounds and subtle borders using the border color token.
2. THE GalleryGrid SHALL apply border-radius between 8px and 12px to gallery item containers.
3. WHEN a user hovers over a GalleryItem, THE GalleryItem SHALL display a border color transition to Emerald_Accent or a subtle scale/shadow effect.
4. THE GalleryGrid empty state message SHALL use muted text color on a Surface_Color background.
5. THE Lightbox backdrop SHALL use a dark overlay (rgba(0, 0, 0, 0.85) or darker).
6. THE Lightbox close button SHALL use primary text color with a hover transition to Emerald_Accent.
7. THE Lightbox caption SHALL use primary text color on a semi-transparent dark background.

### Requirement 10: Form Elements and Buttons

**User Story:** As a platform visitor, I want form inputs and buttons to match the dark theme, so that all interactive elements are visually consistent.

#### Acceptance Criteria

1. THE Theme_System SHALL style input, textarea, and select elements with Surface_Color background, primary text color, and 1px solid border using the border color token.
2. WHEN an input element receives focus, THE Theme_System SHALL display a border color of Emerald_Accent with a subtle emerald glow (box-shadow).
3. THE Theme_System SHALL style the primary button (.btn-primary) with Emerald_Accent background, white text, and a darker emerald hover state.
4. THE Theme_System SHALL style the secondary button (.btn-secondary) with a transparent or Surface_Color background, primary text color, and a border using the border color token.
5. THE Theme_System SHALL apply border-radius between 6px and 8px to all buttons and form inputs.

### Requirement 11: Utility Components Redesign

**User Story:** As a platform visitor, I want pagination, skeleton loaders, error pages, and toasts to match the dark theme, so that every UI state is visually consistent.

#### Acceptance Criteria

1. THE Pagination SHALL display page buttons with Surface_Color background and muted text color, with the active page button using Emerald_Accent background and white text.
2. THE SkeletonLoader SHALL display placeholder bones with a shimmer animation using colors in the range of Surface_Color to a slightly lighter dark shade (#222222 to #2a2a2a).
3. THE ErrorPage SHALL display the error card on Surface_Color background with the error code in Emerald_Accent, title in primary text color, and description in muted text color.
4. THE Toast SHALL display notification messages on Surface_Color background with a left border accent in Emerald_Accent (success), danger color (error), or warning color (warning).

### Requirement 12: Global Retro Style Removal

**User Story:** As a developer, I want all retro-themed CSS patterns removed, so that the codebase is clean and fully aligned with the dark theme.

#### Acceptance Criteria

1. THE Theme_System SHALL remove the .retro-box CSS class and all references to it across components.
2. THE Theme_System SHALL remove the .retro-box-accent CSS class and all references to it across components.
3. THE Theme_System SHALL remove the .retro-divider CSS class and all references to it.
4. THE Theme_System SHALL remove the retro table styling (emerald th background, alternating cream row colors) and replace with dark-themed table styles using Surface_Color headers and subtle row striping.
5. THE Theme_System SHALL update the scrollbar styling to use Dark_Background track and a muted dark thumb color.
6. THE Theme_System SHALL update the ::selection pseudo-element to use Emerald_Accent background with white or Dark_Background text.
7. THE Theme_System SHALL update the border-radius token from 2px to a value between 8px and 12px for a modern rounded appearance.

### Requirement 13: Shadow and Elevation System

**User Story:** As a platform visitor, I want subtle depth cues in the dark interface, so that cards and elevated elements are visually distinguishable from the background.

#### Acceptance Criteria

1. THE Theme_System SHALL define shadow tokens using dark-appropriate values (e.g., 0 1px 3px rgba(0, 0, 0, 0.3) for small, 0 4px 12px rgba(0, 0, 0, 0.4) for medium, 0 8px 24px rgba(0, 0, 0, 0.5) for large).
2. THE Theme_System SHALL define an emerald glow shadow (0 0 8px rgba(16, 185, 129, 0.15) or similar) for hover and focus states on interactive cards and inputs.
3. THE Theme_System SHALL not use light-theme shadow values (rgba(0, 0, 0, 0.08) or similar low-opacity shadows that are invisible on dark backgrounds).

### Requirement 14: Responsive Design Preservation

**User Story:** As a mobile or tablet user, I want the dark theme to work correctly across all viewport sizes, so that the experience is consistent on every device.

#### Acceptance Criteria

1. THE Theme_System SHALL maintain the existing responsive breakpoints at 768px and 1024px.
2. WHILE the viewport width is 768px or less, THE Navbar SHALL hide the desktop navigation links and display the MobileMenu hamburger button.
3. WHILE the viewport width is 768px or less, THE Sidebar SHALL be hidden from the layout.
4. THE GalleryGrid SHALL maintain its responsive column count (adjusting from multi-column to fewer columns on smaller viewports).
5. THE ArticleCard, OutlookCard, and ArticleLongCard SHALL remain fully readable and properly spaced at all viewport widths from 320px to 1920px.

### Requirement 15: Accessibility Compliance

**User Story:** As a user with accessibility needs, I want the dark theme to maintain proper contrast and keyboard navigation, so that the platform remains usable with assistive technologies.

#### Acceptance Criteria

1. THE Theme_System SHALL ensure all text-on-background color combinations meet WCAG_AA contrast ratio (4.5:1 for normal text, 3:1 for large text).
2. THE Theme_System SHALL ensure all focus-visible outlines use Emerald_Accent or primary text color with a 2px solid outline and 2px offset.
3. THE skip-to-content link SHALL use Emerald_Accent background with white text and remain functional with keyboard navigation.
4. THE Lightbox, MobileMenu, and Toast components SHALL maintain their existing ARIA attributes (role, aria-modal, aria-label, aria-expanded) without modification.
5. THE Theme_System SHALL ensure interactive elements (buttons, links, tabs) maintain a minimum touch target of 44x44 pixels.

### Requirement 16: Admin Dashboard Theme Consistency

**User Story:** As an admin user, I want the admin dashboard to use the same dark theme, so that the admin experience is visually consistent with the public-facing pages.

#### Acceptance Criteria

1. THE Admin_Dashboard layout shell (AdminShell, AdminHeader, AdminSidebar) SHALL use Dark_Background and Surface_Color consistent with the public theme.
2. THE Admin_Dashboard data tables (DataTable) SHALL use Surface_Color header rows, Dark_Background body rows, and subtle border separators.
3. THE Admin_Dashboard stat cards (StatsCards) SHALL use Surface_Color backgrounds with Emerald_Accent highlights for key metrics.
4. THE Admin_Dashboard charts (Charts) SHALL use Emerald_Accent as the primary data color on Dark_Background chart areas.
5. THE Admin_Dashboard form components (ArticleEditor, OutlookEditor, CreditSettings) SHALL follow the same dark form element styling defined in Requirement 10.
6. THE Admin_Dashboard login page SHALL use Dark_Background with a centered Surface_Color login card.

### Requirement 17: Light Theme Color System

**User Story:** As a platform visitor who prefers a light interface, I want a light theme option, so that I can use the platform comfortably in bright environments.

#### Acceptance Criteria

1. THE Theme_System SHALL define a Light_Background color token (#ffffff or #fafafa) for the primary page background in light mode.
2. THE Theme_System SHALL define a Light_Surface token (#f5f5f5 to #f0f0f0) for cards, panels, and elevated elements in light mode.
3. THE Theme_System SHALL define a Light_Text color (#111111 to #1a1a1a) for primary body text in light mode.
4. THE Theme_System SHALL define a Light_Muted color (#6b7280 to #9ca3af) for secondary and metadata text in light mode.
5. THE Theme_System SHALL define a Light_Border color (#e5e7eb to #d1d5db) for card and section borders in light mode.
6. THE Theme_System SHALL use the same Emerald_Accent (#10b981) for branding, links, and interactive highlights in light mode.
7. THE Theme_System SHALL define light-appropriate shadow tokens (e.g., 0 1px 3px rgba(0, 0, 0, 0.08) for small, 0 4px 12px rgba(0, 0, 0, 0.1) for medium).
8. ALL components (Navbar, Footer, Sidebar, Cards, CategoryTabs, Gallery, Lightbox, Forms, Pagination, SkeletonLoader, ErrorPage, Toast) SHALL adapt their colors to use the light theme tokens when light mode is active.
9. THE Admin_Dashboard SHALL adapt to light theme tokens when light mode is active.

### Requirement 18: Theme Toggle (Light/Dark Mode Switcher)

**User Story:** As a platform visitor, I want to switch between dark and light themes, so that I can choose the mode that suits my environment and preference.

#### Acceptance Criteria

1. THE ThemeToggle SHALL be displayed in the Navbar as an icon button (sun icon for switching to light, moon icon for switching to dark).
2. THE ThemeToggle SHALL also be displayed in the MobileMenu for mobile users.
3. WHEN a user clicks the ThemeToggle, THE Theme_System SHALL immediately switch all CSS custom properties between dark and light theme values without a page reload.
4. THE ThemeToggle SHALL persist the user's theme preference in localStorage under the key "horizon-theme".
5. WHEN a user visits the platform for the first time (no stored preference), THE Theme_System SHALL default to dark mode.
6. WHEN a user has a stored theme preference, THE Theme_System SHALL apply the stored preference on page load before the first paint (no flash of wrong theme).
7. THE ThemeToggle SHALL apply the theme by setting a `data-theme="dark"` or `data-theme="light"` attribute on the `<html>` element.
8. THE Theme_System SHALL define all color tokens using CSS custom properties scoped to `[data-theme="dark"]` and `[data-theme="light"]` selectors.
9. THE ThemeToggle icon SHALL transition smoothly (opacity or rotation) when switching themes.
10. THE ThemeToggle SHALL maintain a minimum touch target of 44x44 pixels.
