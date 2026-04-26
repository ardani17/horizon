// ============================================
// Horizon Trader Platform — Hashtag Parser & Category Mapper
// ============================================

import type { ArticleCategory } from '../../../shared/types/index';

/**
 * Mapping from recognized hashtags to article categories.
 * Keys are lowercase hashtags (without the `#` prefix).
 * Strict 1:1 mapping — each category has exactly one hashtag.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 5.1, 5.2, 5.3, 5.4
 */
const HASHTAG_CATEGORY_MAP: Record<string, ArticleCategory> = {
  trading: 'trading',
  cerita: 'life_story',
  general: 'general',
};

/**
 * Set of recognized hashtag names (without # prefix) used for stripping.
 * Derived from HASHTAG_CATEGORY_MAP keys.
 *
 * Validates: Requirements 10.1, 10.3, 10.4
 */
const RECOGNIZED_HASHTAGS: Set<string> = new Set(Object.keys(HASHTAG_CATEGORY_MAP));

/**
 * Extract hashtags from a text string.
 *
 * Returns an array of hashtags in lowercase without the `#` prefix,
 * e.g., `"Hello #General world #trading"` → `["general", "trading"]`.
 *
 * Validates: Requirements 8.1, 8.2, 8.7
 */
export function parseHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  if (!matches) {
    return [];
  }
  return matches.map((tag) => tag.slice(1).toLowerCase());
}

/**
 * Map an array of parsed hashtags to an article category.
 *
 * Uses the first recognized hashtag to determine the category.
 * If no recognized hashtag is found, returns "general".
 *
 * The mapping is deterministic — the same input always produces the same output.
 *
 * Validates: Requirements 8.1, 8.2, 8.7
 */
export function mapHashtagToCategory(hashtags: string[]): ArticleCategory {
  for (const tag of hashtags) {
    const category = HASHTAG_CATEGORY_MAP[tag];
    if (category) {
      return category;
    }
  }
  return 'general';
}

/**
 * Remove recognized hashtags from text and normalize whitespace.
 * Unrecognized hashtags (e.g., #bitcoin) are preserved.
 *
 * Validates: Requirements 10.1, 10.3, 10.4
 */
export function stripRecognizedHashtags(text: string): string {
  return text
    .replace(/#(\w+)/g, (match, tag) =>
      RECOGNIZED_HASHTAGS.has(tag.toLowerCase()) ? '' : match
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}
