// ============================================
// Horizon Trader Platform — Media Type Validation
// ============================================

import { MediaTypeInvalidError } from './errors';

/**
 * Allowed top-level MIME type prefixes for media uploads.
 * Only image and video files are accepted.
 */
const ALLOWED_MIME_PREFIXES = ['image/', 'video/'] as const;

/**
 * Validate that a MIME type is an accepted media type (image or video).
 *
 * Accepts any MIME type that starts with `image/` or `video/`
 * (e.g. `image/png`, `image/jpeg`, `video/mp4`, `video/webm`).
 *
 * @param mimeType - The MIME type string to validate
 * @returns `true` if the MIME type is accepted
 * @throws {MediaTypeInvalidError} if the MIME type is not image/* or video/*
 */
export function validateMediaType(mimeType: string): boolean {
  if (!mimeType || typeof mimeType !== 'string') {
    throw new MediaTypeInvalidError(
      'Tipe file tidak valid: MIME type tidak boleh kosong',
      { provided: mimeType ?? null },
    );
  }

  const normalised = mimeType.trim().toLowerCase();

  if (normalised.length === 0) {
    throw new MediaTypeInvalidError(
      'Tipe file tidak valid: MIME type tidak boleh kosong',
      { provided: mimeType },
    );
  }

  const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    normalised.startsWith(prefix),
  );

  if (!isAllowed) {
    throw new MediaTypeInvalidError(
      `Tipe file "${normalised}" tidak didukung. Hanya file gambar (image/*) dan video (video/*) yang diperbolehkan.`,
      { provided: normalised, allowed: ['image/*', 'video/*'] },
    );
  }

  return true;
}
