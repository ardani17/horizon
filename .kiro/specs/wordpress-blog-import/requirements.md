# Requirements Document

## Introduction

This feature imports all published blog articles from the WordPress site at `academy.horizonfx.id` into the Horizon Trader Platform. It introduces a new `blog` article category, a Node.js import script that fetches posts via the WordPress REST API, public blog listing and detail pages following the existing Outlook page pattern, and the necessary navigation and configuration updates to integrate blog content into the platform.

## Glossary

- **Import_Script**: A Node.js CLI script located at `scripts/import-wordpress.js` that fetches posts from the WordPress REST API and inserts them into the database.
- **WordPress_API**: The REST API endpoint at `https://academy.horizonfx.id/wp-json/wp/v2/posts` that returns published WordPress posts in JSON format.
- **Blog_Listing_Page**: The public page at `/blog` that displays a paginated list of blog articles.
- **Blog_Detail_Page**: The public page at `/blog/[slug]` that renders the full content of a single blog article.
- **Articles_Table**: The PostgreSQL `articles` table that stores all article content, including blog imports.
- **Navbar**: The main site navigation header component rendered on all public pages.
- **Admin_Sidebar**: The sidebar navigation component rendered in the admin dashboard.
- **Credit_Settings**: The `credit_settings` database table that defines credit rewards per article category.
- **Image_Config**: The Next.js image configuration in `next.config.mjs` that controls allowed remote image domains.
- **CSP_Config**: The Content Security Policy headers in `next.config.mjs` that control allowed image and media sources.

## Requirements

### Requirement 1: Blog Category Registration

**User Story:** As a platform administrator, I want a `blog` category added to the system, so that imported WordPress articles are properly categorized and distinguishable from user-generated content.

#### Acceptance Criteria

1. THE Articles_Table SHALL accept `blog` as a valid value for the `category` column.
2. THE `VALID_CATEGORIES` constant in `shared/constants.ts` SHALL include `blog` as a valid article category.
3. THE `ArticleCategory` type in `shared/types/index.ts` SHALL include a `BLOG` entry with value `blog`.
4. THE `ArticleSource` type in `shared/types/index.ts` SHALL include a `WORDPRESS` entry with value `wordpress`.
5. THE article creation API route SHALL accept `blog` as a valid category value.

### Requirement 2: Credit Settings for Blog Category

**User Story:** As a platform administrator, I want the blog category to have zero credit reward, so that imported articles do not grant credits since they are not user-generated.

#### Acceptance Criteria

1. THE Credit_Settings SHALL contain a row for the `blog` category with `credit_reward` set to `0` and `is_active` set to `true`.
2. WHEN a blog article is imported, THE Import_Script SHALL not create any credit transaction for the article.

### Requirement 3: WordPress Import Script

**User Story:** As a platform administrator, I want a script that imports all published posts from the WordPress site, so that existing blog content is available on the Horizon Trader Platform.

#### Acceptance Criteria

1. THE Import_Script SHALL fetch all published posts from the WordPress_API using paginated requests with a maximum of 100 posts per page.
2. THE Import_Script SHALL request embedded data from the WordPress_API by appending `_embed` to the request, so that featured media URLs are available in the response.
3. WHEN a WordPress post is fetched, THE Import_Script SHALL extract the `title.rendered`, `content.rendered`, `slug`, `date`, `excerpt.rendered`, and featured media URL from the `_embedded` data.
4. WHEN a WordPress post is processed, THE Import_Script SHALL insert a row into the Articles_Table with `category` set to `blog`, `source` set to `wordpress`, `status` set to `published`, and `content_html` set to the post `content.rendered` value.
5. WHEN a WordPress post has a featured media image in the `_embedded` data, THE Import_Script SHALL store the featured image URL in the `media` table linked to the imported article.
6. WHEN a slug from a WordPress post already exists in the Articles_Table, THE Import_Script SHALL skip that post and log a message indicating the duplicate was skipped.
7. THE Import_Script SHALL preserve the original WordPress `date` value as the `created_at` timestamp for the imported article.
8. THE Import_Script SHALL use the admin user (telegram_id = 0) as the `author_id` for all imported articles.
9. THE Import_Script SHALL log progress to the console, including the total number of posts fetched, the number of posts imported, and the number of posts skipped.
10. THE Import_Script SHALL be executable via `node scripts/import-wordpress.js` from the project root.
11. IF the WordPress_API returns an HTTP error, THEN THE Import_Script SHALL log the error details and exit with a non-zero exit code.
12. IF a database insertion fails for a single post, THEN THE Import_Script SHALL log the error for that post and continue processing the remaining posts.

### Requirement 4: Next.js Image and CSP Configuration

**User Story:** As a user viewing blog articles, I want images from the WordPress site to load correctly, so that the imported content displays as intended.

#### Acceptance Criteria

1. THE Image_Config SHALL include `academy.horizonfx.id` as an allowed remote image hostname.
2. THE CSP_Config SHALL include `https://academy.horizonfx.id` in the `img-src` directive.
3. THE CSP_Config SHALL include `https://academy.horizonfx.id` in the `media-src` directive.

### Requirement 5: Blog Listing Page

**User Story:** As a site visitor, I want to browse all blog articles on a dedicated page, so that I can discover and read imported WordPress content.

#### Acceptance Criteria

1. THE Blog_Listing_Page SHALL be accessible at the URL path `/blog`.
2. THE Blog_Listing_Page SHALL display all articles with category `blog` and status `published`, ordered by `created_at` descending.
3. WHEN blog articles exist, THE Blog_Listing_Page SHALL render each article as a card showing the title, excerpt, publication date, and featured image.
4. WHEN no blog articles exist, THE Blog_Listing_Page SHALL display an empty state message indicating no blog articles are available.
5. THE Blog_Listing_Page SHALL support pagination to handle large numbers of blog articles.
6. THE Blog_Listing_Page SHALL provide a search input that filters blog articles by title or content.
7. THE Blog_Listing_Page SHALL follow the same layout pattern as the Outlook listing page, including the Sidebar component.
8. THE Blog_Listing_Page SHALL include appropriate metadata (title, description, canonical URL) for SEO.

### Requirement 6: Blog Detail Page

**User Story:** As a site visitor, I want to read the full content of a blog article, so that I can consume the imported WordPress content in detail.

#### Acceptance Criteria

1. THE Blog_Detail_Page SHALL be accessible at the URL path `/blog/[slug]` where `[slug]` is the article slug.
2. WHEN a valid published blog article slug is provided, THE Blog_Detail_Page SHALL render the full `content_html` of the article.
3. THE Blog_Detail_Page SHALL display the article title, publication date, and author name.
4. THE Blog_Detail_Page SHALL include share buttons matching the pattern used on the artikel detail page.
5. THE Blog_Detail_Page SHALL include a comment section matching the pattern used on the artikel detail page.
6. THE Blog_Detail_Page SHALL include a like button matching the pattern used on the artikel detail page.
7. WHEN a featured image exists for the article, THE Blog_Detail_Page SHALL display the featured image above the article content.
8. IF the provided slug does not match any published blog article, THEN THE Blog_Detail_Page SHALL return a 404 not-found response.
9. THE Blog_Detail_Page SHALL include a back link to the `/blog` listing page.
10. THE Blog_Detail_Page SHALL include JSON-LD structured data following the Article schema for SEO.
11. THE Blog_Detail_Page SHALL include appropriate Open Graph and Twitter Card metadata for social sharing.

### Requirement 7: Navbar Update

**User Story:** As a site visitor, I want to see a "Blog" link in the main navigation, so that I can easily access the blog section.

#### Acceptance Criteria

1. THE Navbar SHALL include a "Blog" navigation link pointing to `/blog`.
2. THE Navbar SHALL position the "Blog" link between the "Outlook" link and the "Gallery" link.

### Requirement 8: Admin Sidebar Update

**User Story:** As an administrator, I want to see a "Blog" link in the admin sidebar, so that I can manage blog articles from the dashboard.

#### Acceptance Criteria

1. THE Admin_Sidebar SHALL include a "Blog" navigation link pointing to `/admin/blog` in the "Utama" section.
2. THE Admin_Sidebar SHALL position the "Blog" link after the "Outlook" link within the "Utama" section.
3. THE Admin_Sidebar SHALL display an appropriate icon for the "Blog" link.
