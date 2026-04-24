// ============================================
// Horizon Trader Platform — Text-to-HTML Conversion
// ============================================

/**
 * URL regex pattern for auto-linking.
 * Matches http(s) URLs in plain text.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

/**
 * Escape HTML special characters to prevent XSS and ensure
 * content renders as text, not markup.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Auto-link URLs found in text.
 * Converts plain-text URLs into clickable `<a>` tags.
 * Must be called AFTER HTML escaping since we produce raw HTML here.
 *
 * Note: We re-match against the escaped text. Since escapeHtml does not
 * alter URL characters (letters, digits, :, /, ., -, _, ~, ?, #, =, &amp;),
 * the URL pattern still works on escaped output — except `&` becomes `&amp;`.
 * We handle this by matching on the escaped string directly.
 */
function autoLinkUrls(html: string): string {
  // Match URLs in the already-escaped HTML.
  // The escaped `&amp;` in query strings is fine inside href attributes.
  return html.replace(URL_PATTERN, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

/**
 * Apply basic Telegram-style formatting:
 * - *bold* → <strong>bold</strong>
 * - _italic_ → <em>italic</em>
 *
 * Only matches pairs that don't span across line breaks.
 * Must be called AFTER HTML escaping and URL auto-linking.
 */
function applyBasicFormatting(html: string): string {
  // Bold: *text* (not spanning newlines, not inside tags)
  html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');

  // Italic: _text_ (not spanning newlines, not inside URLs/tags)
  html = html.replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, '<em>$1</em>');

  return html;
}

/**
 * Convert Telegram plain text to HTML suitable for storing as `content_html`.
 *
 * Processing pipeline:
 * 1. Escape HTML special characters
 * 2. Auto-link URLs
 * 3. Apply basic formatting (*bold*, _italic_)
 * 4. Convert line breaks to `<br>` tags
 * 5. Wrap in paragraph tags, splitting on double line breaks
 *
 * @param text - Raw plain text from Telegram message
 * @returns HTML string ready for storage and rendering
 */
export function textToHtml(text: string): string {
  if (!text || text.trim().length === 0) {
    return '<p></p>';
  }

  // Step 1: Escape HTML entities
  let html = escapeHtml(text);

  // Step 2: Auto-link URLs
  html = autoLinkUrls(html);

  // Step 3: Apply basic formatting
  html = applyBasicFormatting(html);

  // Step 4: Split into paragraphs on double newlines
  const paragraphs = html.split(/\n{2,}/);

  // Step 5: Within each paragraph, convert single newlines to <br>
  const wrapped = paragraphs
    .map((p) => {
      const content = p.replace(/\n/g, '<br>');
      return `<p>${content}</p>`;
    })
    .join('');

  return wrapped;
}

/**
 * Strip all HTML tags from a string, returning plain text content.
 * Useful for generating excerpts, search indexing, and testing round-trip property.
 *
 * @param html - HTML string to strip
 * @returns Plain text with tags removed
 */
export function stripHtml(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode common HTML entities back to characters
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text;
}
