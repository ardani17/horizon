# Requirements Document

## Introduction

This feature adds dedicated admin CRUD pages for Outlook (market analysis) articles within the Horizon Trader Platform. Currently, admins can only create new Outlook articles via `/admin/outlook/new` and must use the general Articles page for listing, editing, or deleting them. This feature provides a focused admin experience with an Outlook listing page at `/admin/outlook`, an edit page at `/admin/outlook/[id]/edit`, and delete functionality directly from the Outlook listing — all scoped exclusively to articles with category "outlook".

## Glossary

- **Outlook_Listing_Page**: The admin page at `/admin/outlook` that displays a paginated, searchable table of all Outlook articles
- **Outlook_Edit_Page**: The admin page at `/admin/outlook/[id]/edit` that loads an existing Outlook article into the OutlookEditor for modification
- **OutlookEditor**: The existing rich text HTML editor component with inline image upload support, used for creating and editing Outlook articles
- **Admin**: An authenticated user with a valid admin session token
- **Article**: A database record in the articles table representing content with fields including id, title, content_html, category, status, slug, and created_at
- **Inline_Image**: An image uploaded via the OutlookEditor that is embedded directly in the article's HTML content and stored in Cloudflare R2
- **DataTable**: The existing reusable admin table component supporting pagination, search, filters, and action columns

## Requirements

### Requirement 1: Admin Outlook Listing Page

**User Story:** As an admin, I want a dedicated listing page for Outlook articles, so that I can manage market analysis content without navigating through all article types.

#### Acceptance Criteria

1. WHEN an Admin navigates to `/admin/outlook`, THE Outlook_Listing_Page SHALL display a paginated table of articles filtered to category "outlook" only
2. THE Outlook_Listing_Page SHALL display the following columns for each article: title, status, author, media count, and creation date
3. WHEN an Admin enters text in the search field, THE Outlook_Listing_Page SHALL filter the displayed articles by matching title or content
4. THE Outlook_Listing_Page SHALL provide a status filter with options: all statuses, published, hidden, and draft
5. THE Outlook_Listing_Page SHALL display a "New Outlook" button that navigates to `/admin/outlook/new`
6. THE Outlook_Listing_Page SHALL paginate results with 20 articles per page
7. WHEN no Outlook articles exist, THE Outlook_Listing_Page SHALL display an empty state message indicating no Outlook articles are available

### Requirement 2: Admin Outlook Edit Page

**User Story:** As an admin, I want to edit existing Outlook articles using the same rich text editor used for creation, so that I can update market analysis content with inline images.

#### Acceptance Criteria

1. WHEN an Admin navigates to `/admin/outlook/[id]/edit`, THE Outlook_Edit_Page SHALL load the existing article data and display it in the OutlookEditor
2. THE Outlook_Edit_Page SHALL pre-populate the title, content HTML, and status fields with the existing article values
3. WHEN an Admin submits the edit form, THE Outlook_Edit_Page SHALL send a PUT request to `/api/articles/[id]` with the updated data
4. WHEN an Admin adds new inline images during editing, THE Outlook_Edit_Page SHALL upload each image to `/api/media/upload` and replace blob URLs with the returned file URLs before saving
5. IF the article with the specified ID does not exist, THEN THE Outlook_Edit_Page SHALL display an error message indicating the article was not found
6. IF the API returns an error during save, THEN THE Outlook_Edit_Page SHALL display the error message to the Admin without losing the edited content
7. WHEN the save operation succeeds, THE Outlook_Edit_Page SHALL redirect the Admin to the Outlook listing page at `/admin/outlook`

### Requirement 3: Admin Outlook Delete Functionality

**User Story:** As an admin, I want to delete Outlook articles directly from the Outlook listing page, so that I can remove outdated market analysis without switching to the general Articles page.

#### Acceptance Criteria

1. THE Outlook_Listing_Page SHALL display a delete action button for each article row
2. WHEN an Admin clicks the delete button, THE Outlook_Listing_Page SHALL display a confirmation dialog showing the article title
3. WHEN an Admin confirms the deletion, THE Outlook_Listing_Page SHALL send a DELETE request to `/api/articles/[id]`
4. WHEN the delete operation succeeds, THE Outlook_Listing_Page SHALL refresh the article list to reflect the removal
5. IF the delete API returns an error, THEN THE Outlook_Listing_Page SHALL display an error notification to the Admin

### Requirement 4: Admin Outlook Status Toggle

**User Story:** As an admin, I want to quickly toggle the publish status of Outlook articles from the listing page, so that I can show or hide market analysis without opening the editor.

#### Acceptance Criteria

1. THE Outlook_Listing_Page SHALL display a status toggle action button for each article row
2. WHEN an Admin clicks the status toggle on a published article, THE Outlook_Listing_Page SHALL send a PUT request to `/api/articles/[id]` with status "hidden"
3. WHEN an Admin clicks the status toggle on a hidden or draft article, THE Outlook_Listing_Page SHALL send a PUT request to `/api/articles/[id]` with status "published"
4. WHEN the status toggle operation succeeds, THE Outlook_Listing_Page SHALL refresh the article list to reflect the updated status

### Requirement 5: Outlook Listing Page Navigation Actions

**User Story:** As an admin, I want to navigate to the edit page directly from the Outlook listing, so that I can quickly access any article for modification.

#### Acceptance Criteria

1. THE Outlook_Listing_Page SHALL display an edit action button for each article row
2. WHEN an Admin clicks the edit button for an article, THE Outlook_Listing_Page SHALL navigate to `/admin/outlook/[id]/edit`
3. WHEN an Admin clicks the article title in the listing, THE Outlook_Listing_Page SHALL navigate to `/admin/outlook/[id]/edit`

### Requirement 6: OutlookEditor Edit Mode Support

**User Story:** As an admin, I want the OutlookEditor to support pre-populated data for editing, so that the same component can be reused for both creating and editing Outlook articles.

#### Acceptance Criteria

1. WHERE the OutlookEditor receives initial data, THE OutlookEditor SHALL pre-populate the title field with the provided title value
2. WHERE the OutlookEditor receives initial data, THE OutlookEditor SHALL pre-populate the HTML content area with the provided content_html value
3. WHERE the OutlookEditor receives initial data, THE OutlookEditor SHALL pre-populate the status selector with the provided status value
4. THE OutlookEditor SHALL accept an optional `initialData` prop containing title, content_html, and status fields
5. THE OutlookEditor SHALL accept a customizable `submitLabel` prop to differentiate between create and edit modes
