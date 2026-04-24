// ============================================
// Horizon Trader Platform — Hashtag Parser & Category Mapper
// ============================================

import type { ArticleCategory } from '../../../shared/types/index';

/**
 * Mapping from recognized hashtags to article categories.
 * Keys are lowercase hashtags (without the `#` prefix).
 *
 * Validates: Requirements 8.1, 8.2
 */
const HASHTAG_CATEGORY_MAP: Record<string, ArticleCategory> = {
  jurnal: 'trading',
  trading: 'trading',
  cerita: 'life_story',
  kehidupan: 'life_story',
};

/**
 * Extract hashtags from a text string.
 *
 * Returns an array of hashtags in lowercase without the `#` prefix,
 * e.g., `"Hello #Jurnal world #trading"` → `["jurnal", "trading"]`.
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
