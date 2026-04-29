import DOMPurify from 'isomorphic-dompurify';

/**
 * Allowed HTML tags and attributes for article content.
 * Permits standard formatting, images, videos, and links
 * while stripping scripts, iframes, and event handlers.
 */
const ALLOWED_TAGS = [
  // Text formatting
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  // Lists
  'ul', 'ol', 'li',
  // Links
  'a',
  // Media
  'img', 'video', 'source', 'audio',
  // Tables
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // Other
  'div', 'span', 'hr', 'figure', 'figcaption',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'title', 'alt',
  'src', 'width', 'height', 'loading',
  'controls', 'preload', 'muted', 'playsinline', 'autoplay', 'loop',
  'type',
  'class', 'style',
  'colspan', 'rowspan',
];

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Strips all script tags, event handlers, and dangerous attributes
 * while preserving safe formatting, images, videos, and links.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ['video', 'source', 'audio'],
    ADD_ATTR: ['controls', 'preload', 'muted', 'playsinline', 'autoplay', 'loop'],
  });
}
