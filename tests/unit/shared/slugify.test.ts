import { describe, it, expect } from 'vitest';
import { slugify, extractFirstWords } from '../../../shared/utils/slugify';

describe('slugify', () => {
  const FIXED_SUFFIX = 'abc123';

  it('converts a simple title to a valid slug', () => {
    const result = slugify('Judul Artikel Baru', FIXED_SUFFIX);
    expect(result).toBe('judul-artikel-baru-abc123');
  });

  it('lowercases the input', () => {
    const result = slugify('HELLO WORLD', FIXED_SUFFIX);
    expect(result).toBe('hello-world-abc123');
  });

  it('replaces spaces with hyphens', () => {
    const result = slugify('hello world test', FIXED_SUFFIX);
    expect(result).toBe('hello-world-test-abc123');
  });

  it('removes special characters', () => {
    const result = slugify('Hello! @World #2024', FIXED_SUFFIX);
    expect(result).toBe('hello-world-2024-abc123');
  });

  it('collapses consecutive hyphens', () => {
    const result = slugify('hello---world', FIXED_SUFFIX);
    expect(result).toBe('hello-world-abc123');
  });

  it('trims leading and trailing hyphens from the base', () => {
    const result = slugify('---hello---', FIXED_SUFFIX);
    expect(result).toBe('hello-abc123');
  });

  it('handles empty input by returning only the suffix', () => {
    const result = slugify('', FIXED_SUFFIX);
    expect(result).toBe('abc123');
  });

  it('handles input with only special characters', () => {
    const result = slugify('!@#$%^&*()', FIXED_SUFFIX);
    expect(result).toBe('abc123');
  });

  it('handles input with only whitespace', () => {
    const result = slugify('   ', FIXED_SUFFIX);
    expect(result).toBe('abc123');
  });

  it('truncates very long titles to 60 characters before slugifying', () => {
    const longTitle = 'a'.repeat(100);
    const result = slugify(longTitle, FIXED_SUFFIX);
    // 60 'a' chars + '-' + suffix
    expect(result).toBe('a'.repeat(60) + '-abc123');
  });

  it('truncates at 60 chars then processes the result', () => {
    // 55 chars of 'a' + 5 spaces + more text = truncated at 60
    const input = 'a'.repeat(55) + '     extra text beyond limit';
    const result = slugify(input, FIXED_SUFFIX);
    // After truncation: 55 'a' + 5 spaces → 55 'a' + '-' (spaces become hyphens, collapsed)
    expect(result).toBe('a'.repeat(55) + '-abc123');
  });

  it('handles unicode and non-latin characters by removing them', () => {
    const result = slugify('Analisa Pasar 日本語 テスト', FIXED_SUFFIX);
    expect(result).toBe('analisa-pasar-abc123');
  });

  it('handles mixed alphanumeric and special chars', () => {
    const result = slugify('Trading Journal #1 - BTC/USD Analysis!', FIXED_SUFFIX);
    // Special chars removed, consecutive hyphens collapsed
    expect(result).toBe('trading-journal-1-btcusd-analysis-abc123');
  });

  it('preserves numbers in the slug', () => {
    const result = slugify('Top 10 Trading Tips 2024', FIXED_SUFFIX);
    expect(result).toBe('top-10-trading-tips-2024-abc123');
  });

  it('handles tabs and newlines as whitespace', () => {
    const result = slugify('hello\tworld\nnew', FIXED_SUFFIX);
    expect(result).toBe('hello-world-new-abc123');
  });

  it('generates a random 6-char suffix when none is provided', () => {
    const result = slugify('test article');
    // Should match pattern: base-xxxxxx where x is [a-z0-9]
    expect(result).toMatch(/^test-article-[a-z0-9]{6}$/);
  });

  it('generates different slugs for the same input (random suffix)', () => {
    const result1 = slugify('same title');
    const result2 = slugify('same title');
    // Extremely unlikely to be the same with random suffixes
    // But both should have the same base
    expect(result1).toMatch(/^same-title-[a-z0-9]{6}$/);
    expect(result2).toMatch(/^same-title-[a-z0-9]{6}$/);
  });

  it('result never starts with a hyphen', () => {
    const result = slugify('-leading hyphen', FIXED_SUFFIX);
    expect(result[0]).not.toBe('-');
  });

  it('result never ends with a hyphen (before suffix)', () => {
    const result = slugify('trailing hyphen-', FIXED_SUFFIX);
    // The slug should be "trailing-hyphen-abc123", not "trailing-hyphen--abc123"
    expect(result).toBe('trailing-hyphen-abc123');
    expect(result).not.toContain('--');
  });
});

describe('extractFirstWords', () => {
  it('extracts the first 8 words by default', () => {
    const text = 'one two three four five six seven eight nine ten';
    expect(extractFirstWords(text)).toBe('one two three four five six seven eight');
  });

  it('returns all words if fewer than count', () => {
    const text = 'hello world';
    expect(extractFirstWords(text)).toBe('hello world');
  });

  it('handles custom word count', () => {
    const text = 'one two three four five';
    expect(extractFirstWords(text, 3)).toBe('one two three');
  });

  it('trims leading and trailing whitespace', () => {
    const text = '  hello world  ';
    expect(extractFirstWords(text)).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(extractFirstWords('')).toBe('');
  });

  it('handles multiple spaces between words', () => {
    const text = 'hello   world   test';
    expect(extractFirstWords(text, 2)).toBe('hello world');
  });
});
