import { describe, it, expect } from 'vitest';
import { textToHtml, stripHtml } from '../../../shared/utils/textToHtml';

describe('textToHtml', () => {
  it('wraps plain text in paragraph tags', () => {
    const result = textToHtml('Hello world');
    expect(result).toBe('<p>Hello world</p>');
  });

  it('returns empty paragraph for empty string', () => {
    expect(textToHtml('')).toBe('<p></p>');
  });

  it('returns empty paragraph for whitespace-only input', () => {
    expect(textToHtml('   ')).toBe('<p></p>');
  });

  it('converts single line breaks to <br> tags', () => {
    const result = textToHtml('line one\nline two\nline three');
    expect(result).toBe('<p>line one<br>line two<br>line three</p>');
  });

  it('splits double line breaks into separate paragraphs', () => {
    const result = textToHtml('paragraph one\n\nparagraph two');
    expect(result).toBe('<p>paragraph one</p><p>paragraph two</p>');
  });

  it('handles mixed single and double line breaks', () => {
    const result = textToHtml('line one\nline two\n\nparagraph two');
    expect(result).toBe('<p>line one<br>line two</p><p>paragraph two</p>');
  });

  it('escapes HTML special characters', () => {
    const result = textToHtml('<script>alert("xss")</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('escapes ampersands', () => {
    const result = textToHtml('Tom & Jerry');
    expect(result).toBe('<p>Tom &amp; Jerry</p>');
  });

  it('escapes quotes', () => {
    const result = textToHtml('He said "hello" and \'bye\'');
    expect(result).toContain('&quot;hello&quot;');
    expect(result).toContain('&#39;bye&#39;');
  });

  it('auto-links HTTP URLs', () => {
    const result = textToHtml('Visit http://example.com for more');
    expect(result).toContain('<a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a>');
  });

  it('auto-links HTTPS URLs', () => {
    const result = textToHtml('Check https://example.com/path?q=1');
    expect(result).toContain('<a href="https://example.com/path?q=1"');
  });

  it('auto-links multiple URLs in the same text', () => {
    const result = textToHtml('See https://a.com and https://b.com');
    expect(result).toContain('href="https://a.com"');
    expect(result).toContain('href="https://b.com"');
  });

  it('applies bold formatting with asterisks', () => {
    const result = textToHtml('This is *bold* text');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('applies italic formatting with underscores', () => {
    const result = textToHtml('This is _italic_ text');
    expect(result).toContain('<em>italic</em>');
  });

  it('handles bold and italic together', () => {
    const result = textToHtml('*bold* and _italic_ text');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('does not apply formatting across line breaks', () => {
    const result = textToHtml('*not\nbold*');
    expect(result).not.toContain('<strong>');
    expect(result).toContain('*not');
  });

  it('handles a realistic Telegram trading journal message', () => {
    const message = '#jurnal BTC/USD Analysis\n\nEntry: 42000\nSL: 41500\nTP: 43000\n\nRisk/Reward: 1:2\nConfidence: *High*';
    const result = textToHtml(message);

    // Should have multiple paragraphs
    expect(result).toContain('<p>#jurnal BTC/USD Analysis</p>');
    expect(result).toContain('<br>');
    expect(result).toContain('<strong>High</strong>');
  });

  it('handles URLs with special characters in query params', () => {
    const result = textToHtml('Link: https://example.com/search?q=hello&lang=en');
    // The & in the URL gets escaped to &amp; by escapeHtml
    expect(result).toContain('href="https://example.com/search?q=hello&amp;lang=en"');
  });

  it('preserves text content through the conversion', () => {
    const input = 'Hello world, this is a test message with numbers 123';
    const result = textToHtml(input);
    const stripped = stripHtml(result);
    expect(stripped).toBe(input);
  });
});

describe('stripHtml', () => {
  it('removes all HTML tags', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(stripHtml('&lt;script&gt;')).toBe('<script>');
    expect(stripHtml('&quot;hello&quot;')).toBe('"hello"');
    expect(stripHtml('&#39;bye&#39;')).toBe("'bye'");
  });

  it('handles nested tags', () => {
    expect(stripHtml('<p><strong><em>text</em></strong></p>')).toBe('text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles string with no tags', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('handles self-closing tags', () => {
    expect(stripHtml('line one<br>line two')).toBe('line oneline two');
  });

  it('handles anchor tags', () => {
    expect(stripHtml('<a href="https://example.com">link</a>')).toBe('link');
  });
});

describe('textToHtml round-trip', () => {
  it('preserves all words through textToHtml → stripHtml', () => {
    const input = 'Hello world this is a test';
    const html = textToHtml(input);
    const stripped = stripHtml(html);
    const inputWords = input.split(/\s+/).filter(Boolean);
    const outputWords = stripped.split(/\s+/).filter(Boolean);

    for (const word of inputWords) {
      expect(outputWords).toContain(word);
    }
  });

  it('preserves words with special characters through round-trip', () => {
    const input = 'Price < 100 & profit > 50';
    const html = textToHtml(input);
    const stripped = stripHtml(html);

    expect(stripped).toContain('Price');
    expect(stripped).toContain('<');
    expect(stripped).toContain('100');
    expect(stripped).toContain('&');
    expect(stripped).toContain('profit');
    expect(stripped).toContain('>');
    expect(stripped).toContain('50');
  });

  it('preserves words across paragraphs through round-trip', () => {
    const input = 'first paragraph\n\nsecond paragraph';
    const html = textToHtml(input);
    const stripped = stripHtml(html);

    expect(stripped).toContain('first');
    expect(stripped).toContain('paragraph');
    expect(stripped).toContain('second');
  });
});
