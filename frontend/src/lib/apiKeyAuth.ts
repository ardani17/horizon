// ============================================
// Horizon Trader Platform — API Key Authentication
// ============================================

import bcrypt from 'bcrypt';
import { query, execute } from '@shared/db';
import type { ApiKey } from '@shared/types';

/**
 * Result of a successful API key validation.
 * Contains the API key record for downstream use (e.g., CORS, rate limiting, logging).
 */
export interface ValidatedApiKey {
  id: string;
  key_prefix: string;
  app_name: string;
  created_by: string;
  allowed_origins: string | null;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
}

/**
 * Extract the API key from the X-API-Key header.
 *
 * Returns the raw key string, or null if the header is missing or empty.
 */
export function extractApiKey(headerValue: string | null | undefined): string | null {
  if (!headerValue || headerValue.trim() === '') {
    return null;
  }
  return headerValue.trim();
}

/**
 * Validate an API key against the api_keys table.
 *
 * Since API keys are stored as bcrypt hashes, we cannot do a direct lookup.
 * Instead, we use the key_prefix (first 8 characters) to narrow down candidates,
 * then compare each candidate with bcrypt.
 *
 * On success:
 * - Updates `last_used_at` timestamp
 * - Returns the API key record
 *
 * On failure (missing key, no match, inactive key):
 * - Returns null
 *
 * @param rawKey - The raw API key from the X-API-Key header
 * @returns The validated API key record, or null
 */
export async function validateApiKey(rawKey: string): Promise<ValidatedApiKey | null> {
  if (!rawKey || rawKey.trim() === '') {
    return null;
  }

  // Extract the prefix (first 8 characters) to narrow down candidates
  const prefix = rawKey.slice(0, 8);

  // Fetch candidate keys matching the prefix
  const result = await query<ApiKey>(
    `SELECT id, key_hash, key_prefix, app_name, created_by,
            allowed_origins, is_active, last_used_at, created_at
     FROM api_keys
     WHERE key_prefix = $1`,
    [prefix],
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Iterate through candidates and compare bcrypt hashes
  for (const candidate of result.rows) {
    const isMatch = await bcrypt.compare(rawKey, candidate.key_hash);

    if (isMatch) {
      // Check if the key is active
      if (!candidate.is_active) {
        return null;
      }

      // Update last_used_at timestamp
      await execute(
        `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
        [candidate.id],
      );

      // Return the validated key record (without the hash)
      return {
        id: candidate.id,
        key_prefix: candidate.key_prefix,
        app_name: candidate.app_name,
        created_by: candidate.created_by,
        allowed_origins: candidate.allowed_origins,
        is_active: candidate.is_active,
        last_used_at: candidate.last_used_at,
        created_at: candidate.created_at,
      };
    }
  }

  // No matching key found
  return null;
}

/**
 * Authenticate a request using the X-API-Key header.
 *
 * This is the main entry point for API key authentication in Credit API routes.
 * It extracts the key from the header, validates it, and returns the result.
 *
 * @param headers - The request headers (from NextRequest)
 * @returns The validated API key record, or null if authentication fails
 */
export async function authenticateApiKey(
  headers: Headers,
): Promise<ValidatedApiKey | null> {
  const rawKey = extractApiKey(headers.get('x-api-key'));

  if (!rawKey) {
    return null;
  }

  return validateApiKey(rawKey);
}
