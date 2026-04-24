import { describe, it, expect } from 'vitest';
import { validateMediaType } from '../../../shared/utils/mediaValidation';
import { MediaTypeInvalidError } from '../../../shared/utils/errors';

describe('validateMediaType', () => {
  // ---- Accepted image types ----

  describe('accepted image types', () => {
    const imageTypes = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'image/avif',
    ];

    for (const mime of imageTypes) {
      it(`accepts ${mime}`, () => {
        expect(validateMediaType(mime)).toBe(true);
      });
    }
  });

  // ---- Accepted video types ----

  describe('accepted video types', () => {
    const videoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo',
      'video/mpeg',
    ];

    for (const mime of videoTypes) {
      it(`accepts ${mime}`, () => {
        expect(validateMediaType(mime)).toBe(true);
      });
    }
  });

  // ---- Case insensitivity ----

  describe('case insensitivity', () => {
    it('accepts uppercase IMAGE/PNG', () => {
      expect(validateMediaType('IMAGE/PNG')).toBe(true);
    });

    it('accepts mixed case Video/Mp4', () => {
      expect(validateMediaType('Video/Mp4')).toBe(true);
    });
  });

  // ---- Whitespace handling ----

  describe('whitespace handling', () => {
    it('accepts mime type with leading/trailing spaces', () => {
      expect(validateMediaType('  image/jpeg  ')).toBe(true);
    });
  });

  // ---- Rejected types ----

  describe('rejected types', () => {
    const rejectedTypes = [
      'application/pdf',
      'application/json',
      'text/plain',
      'text/html',
      'audio/mpeg',
      'audio/wav',
      'application/zip',
      'application/octet-stream',
      'font/woff2',
    ];

    for (const mime of rejectedTypes) {
      it(`rejects ${mime} with MediaTypeInvalidError`, () => {
        expect(() => validateMediaType(mime)).toThrow(MediaTypeInvalidError);
      });

      it(`includes descriptive error message for ${mime}`, () => {
        try {
          validateMediaType(mime);
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(MediaTypeInvalidError);
          const error = err as MediaTypeInvalidError;
          expect(error.message).toContain(mime);
          expect(error.message).toContain('image/*');
          expect(error.message).toContain('video/*');
          expect(error.details).toEqual({
            provided: mime,
            allowed: ['image/*', 'video/*'],
          });
        }
      });
    }
  });

  // ---- Invalid inputs ----

  describe('invalid inputs', () => {
    it('throws for empty string', () => {
      expect(() => validateMediaType('')).toThrow(MediaTypeInvalidError);
    });

    it('throws for whitespace-only string', () => {
      expect(() => validateMediaType('   ')).toThrow(MediaTypeInvalidError);
    });

    it('throws for string without slash', () => {
      expect(() => validateMediaType('imagepng')).toThrow(MediaTypeInvalidError);
    });

    it('throws for partial prefix "image" without slash', () => {
      expect(() => validateMediaType('image')).toThrow(MediaTypeInvalidError);
    });

    it('throws for partial prefix "video" without slash', () => {
      expect(() => validateMediaType('video')).toThrow(MediaTypeInvalidError);
    });
  });

  // ---- Error structure ----

  describe('error structure', () => {
    it('has error code MEDIA_TYPE_INVALID', () => {
      try {
        validateMediaType('application/pdf');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(MediaTypeInvalidError);
        const error = err as MediaTypeInvalidError;
        expect(error.errorCode).toBe('MEDIA_TYPE_INVALID');
        expect(error.httpStatus).toBe(422);
      }
    });
  });
});
