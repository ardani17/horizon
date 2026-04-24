// ============================================
// Horizon Trader Platform — Slug Generation
// ============================================

const MAX_SLUG_LENGTH = 60;
const SUFFIX_LENGTH = 6;
const SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random alphanumeric suffix of the given length.
 * Extracted for testability — can be overridden in tests via the
 * optional `randomSuffix` parameter on `slugify`.
 */
function generateRandomSuffix(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return result;
}

/**
 * Generate a URL-safe slug from an article title or content string.
 *
 * Algorithm (per design doc — Slug Generation Strategy):
 * 1. Take the first 60 characters from the input
 * 2. Lowercase, replace spaces with `-`, remove non-alphanumeric characters
 * 3. Collapse consecutive hyphens, trim leading/trailing hyphens
 * 4. Append 6-char random suffix for uniqueness: `judul-artikel-abc123`
 *
 * For articles from Telegram without an explicit title, callers should
 * pass the first 8 words of the content as the input.
 *
 * @param input  - The title or content string to slugify
 * @param suffix - Optional override for the random suffix (useful for testing)
 * @returns A valid, non-empty slug string
 */
export function slugify(input: string, suffix?: string): string {
  // Truncate to MAX_SLUG_LENGTH characters first
  const truncated = input.slice(0, MAX_SLUG_LENGTH);

  // Lowercase
  const lowered = truncated.toLowerCase();

  // Replace spaces (and common whitespace) with hyphens
  const hyphenated = lowered.replace(/\s+/g, '-');

  // Remove anything that isn't lowercase alphanumeric or hyphen
  const cleaned = hyphenated.replace(/[^a-z0-9-]/g, '');

  // Collapse consecutive hyphens into one
  const collapsed = cleaned.replace(/-{2,}/g, '-');

  // Trim leading and trailing hyphens
  const trimmed = collapsed.replace(/^-+|-+$/g, '');

  // Generate or use provided suffix
  const slugSuffix = suffix ?? generateRandomSuffix(SUFFIX_LENGTH);

  // If the base is empty (input was all special chars / empty), use suffix only
  if (trimmed.length === 0) {
    return slugSuffix;
  }

  return `${trimmed}-${slugSuffix}`;
}

/**
 * Extract the first N words from a text string.
 * Useful for generating slug input from Telegram messages without an explicit title.
 */
export function extractFirstWords(text: string, count: number = 8): string {
  return text.trim().split(/\s+/).slice(0, count).join(' ');
}
