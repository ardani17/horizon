// ============================================
// Horizon Trader Platform — Hashtag Parser & Category Mapper Tests
// ============================================

import { describe, it, expect } from 'vitest';
import { parseHashtags, mapHashtagToCategory } from '../../../bot/src/utils/hashtag';

// ---- parseHashtags Tests ----

describe('parseHashtags', () => {
  it('should extract a single hashtag', () => {
    expect(parseHashtags('Hello #jurnal world')).toEqual(['jurnal']);
  });

  it('should extract multiple hashtags', () => {
    expect(parseHashtags('#jurnal some text #trading')).toEqual(['jurnal', 'trading']);
  });

  it('should return lowercase hashtags regardless of input case', () => {
    expect(parseHashtags('#Jurnal #TRADING #Cerita')).toEqual(['jurnal', 'trading', 'cerita']);
  });

  it('should return empty array when no hashtags are present', () => {
    expect(parseHashtags('Just a regular message')).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseHashtags('')).toEqual([]);
  });

  it('should handle hashtag at the beginning of text', () => {
    expect(parseHashtags('#kehidupan My life story')).toEqual(['kehidupan']);
  });

  it('should handle hashtag at the end of text', () => {
    expect(parseHashtags('My trading journal #trading')).toEqual(['trading']);
  });

  it('should handle consecutive hashtags', () => {
    expect(parseHashtags('#jurnal#trading')).toEqual(['jurnal', 'trading']);
  });

  it('should strip the # prefix from results', () => {
    const result = parseHashtags('#jurnal');
    expect(result[0]).not.toContain('#');
  });

  it('should handle unrecognized hashtags', () => {
    expect(parseHashtags('#random #unknown')).toEqual(['random', 'unknown']);
  });

  it('should handle mixed recognized and unrecognized hashtags', () => {
    expect(parseHashtags('#jurnal #random #cerita')).toEqual(['jurnal', 'random', 'cerita']);
  });
});

// ---- mapHashtagToCategory Tests ----

describe('mapHashtagToCategory', () => {
  it('should map #jurnal to trading', () => {
    expect(mapHashtagToCategory(['jurnal'])).toBe('trading');
  });

  it('should map #trading to trading', () => {
    expect(mapHashtagToCategory(['trading'])).toBe('trading');
  });

  it('should map #cerita to life_story', () => {
    expect(mapHashtagToCategory(['cerita'])).toBe('life_story');
  });

  it('should map #kehidupan to life_story', () => {
    expect(mapHashtagToCategory(['kehidupan'])).toBe('life_story');
  });

  it('should return general when no recognized hashtags', () => {
    expect(mapHashtagToCategory(['random', 'unknown'])).toBe('general');
  });

  it('should return general for empty array', () => {
    expect(mapHashtagToCategory([])).toBe('general');
  });

  it('should use the first recognized hashtag for category', () => {
    // #cerita comes first → life_story, even though #trading is also present
    expect(mapHashtagToCategory(['cerita', 'trading'])).toBe('life_story');
  });

  it('should skip unrecognized hashtags and use first recognized one', () => {
    expect(mapHashtagToCategory(['random', 'unknown', 'jurnal'])).toBe('trading');
  });

  it('should be deterministic — same input always produces same output', () => {
    const input = ['cerita', 'trading'];
    const result1 = mapHashtagToCategory(input);
    const result2 = mapHashtagToCategory(input);
    const result3 = mapHashtagToCategory(input);
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('should be deterministic for general category', () => {
    const input = ['random'];
    const result1 = mapHashtagToCategory(input);
    const result2 = mapHashtagToCategory(input);
    expect(result1).toBe('general');
    expect(result2).toBe('general');
  });
});

// ---- Integration: parseHashtags + mapHashtagToCategory ----

describe('parseHashtags + mapHashtagToCategory integration', () => {
  it('should categorize a #jurnal message as trading', () => {
    const hashtags = parseHashtags('My trading journal entry #jurnal');
    expect(mapHashtagToCategory(hashtags)).toBe('trading');
  });

  it('should categorize a #trading message as trading', () => {
    const hashtags = parseHashtags('#trading EURUSD analysis');
    expect(mapHashtagToCategory(hashtags)).toBe('trading');
  });

  it('should categorize a #cerita message as life_story', () => {
    const hashtags = parseHashtags('Hari ini saya belajar #cerita');
    expect(mapHashtagToCategory(hashtags)).toBe('life_story');
  });

  it('should categorize a #kehidupan message as life_story', () => {
    const hashtags = parseHashtags('#kehidupan Refleksi pagi ini');
    expect(mapHashtagToCategory(hashtags)).toBe('life_story');
  });

  it('should categorize a message without recognized hashtags as general', () => {
    const hashtags = parseHashtags('Just chatting about stuff');
    expect(mapHashtagToCategory(hashtags)).toBe('general');
  });

  it('should categorize a message with unrecognized hashtags as general', () => {
    const hashtags = parseHashtags('Check this out #random #stuff');
    expect(mapHashtagToCategory(hashtags)).toBe('general');
  });

  it('should use first recognized hashtag when multiple are present', () => {
    const hashtags = parseHashtags('#kehidupan #jurnal mixed content');
    expect(mapHashtagToCategory(hashtags)).toBe('life_story');
  });
});
