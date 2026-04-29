// ============================================
// Horizon Trader Platform — Shared Constants
// ============================================

/** Pagination defaults */
export const PAGINATION = {
  /** Default page size for admin listings */
  ADMIN_PAGE_SIZE: 20,
  /** Default page size for log viewer */
  LOG_PAGE_SIZE: 30,
  /** Default page size for gallery */
  GALLERY_PAGE_SIZE: 18,
  /** Default page size for outlook listing */
  OUTLOOK_PAGE_SIZE: 20,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 100,
  /** Maximum allowed offset for public endpoints */
  MAX_OFFSET: 10000,
  /** Default page size for blog listing */
  BLOG_PAGE_SIZE: 12,
} as const;

/** Rate limiting (requests per window) */
export const RATE_LIMITS = {
  /** Public like toggle: max requests per IP per window */
  LIKES_MAX: 30,
  /** Public comment creation: max requests per IP per window */
  COMMENTS_MAX: 10,
  /** Public gallery fetch: max requests per IP per window */
  GALLERY_MAX: 60,
  /** Rate limit window in milliseconds (1 minute) */
  WINDOW_MS: 60_000,
} as const;

/** Session configuration */
export const SESSION = {
  /** Session cookie name */
  COOKIE_NAME: 'horizon_session',
  /** Session duration in milliseconds (24 hours) */
  DURATION_MS: 24 * 60 * 60 * 1000,
} as const;

/** Content limits */
export const CONTENT = {
  /** Maximum comment length in characters */
  MAX_COMMENT_LENGTH: 2000,
  /** Maximum display name length */
  MAX_DISPLAY_NAME_LENGTH: 100,
  /** Maximum credit adjustment amount */
  MAX_CREDIT_ADJUSTMENT: 10000,
} as const;

/** Valid article categories */
export const VALID_CATEGORIES = ['trading', 'life_story', 'general', 'outlook', 'blog'] as const;
export type ArticleCategory = (typeof VALID_CATEGORIES)[number];

/** Valid article statuses */
export const VALID_STATUSES = ['published', 'hidden', 'draft'] as const;
export type ArticleStatus = (typeof VALID_STATUSES)[number];
