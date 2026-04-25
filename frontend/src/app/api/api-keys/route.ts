import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';

/** Prefix for all generated API keys */
const KEY_PREFIX = 'hzn_';

/** Number of random characters after the prefix */
const KEY_RANDOM_LENGTH = 32;

/** bcrypt salt rounds */
const BCRYPT_ROUNDS = 10;

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  app_name: string;
  created_by: string;
  allowed_origins: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  creator_username: string | null;
}

/**
 * Generate a random API key with the `hzn_` prefix.
 * Returns the raw key string (e.g., `hzn_a1b2c3d4...`).
 */
function generateApiKey(): string {
  const randomPart = randomBytes(KEY_RANDOM_LENGTH)
    .toString('base64url')
    .slice(0, KEY_RANDOM_LENGTH);
  return `${KEY_PREFIX}${randomPart}`;
}

/**
 * Build a standard error response.
 */
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: {
        error_code: code,
        message,
        details: null,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}

/**
 * GET /api/api-keys — List all API keys (admin-only).
 *
 * Returns key metadata (prefix, app name, status, dates).
 * The full key hash is never returned.
 *
 * Requirements: 18.3
 */
export async function GET() {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  try {
    const result = await query<ApiKeyRow>(
      `SELECT ak.id, ak.key_prefix, ak.app_name, ak.created_by,
              ak.allowed_origins, ak.is_active, ak.last_used_at, ak.created_at,
              u.username AS creator_username
       FROM api_keys ak
       LEFT JOIN users u ON u.id = ak.created_by
       ORDER BY ak.created_at DESC`,
    );

    const keys = result.rows.map((row) => ({
      id: row.id,
      key_prefix: row.key_prefix,
      app_name: row.app_name,
      created_by: row.created_by,
      creator_username: row.creator_username,
      allowed_origins: row.allowed_origins,
      is_active: row.is_active,
      last_used_at: row.last_used_at ? String(row.last_used_at) : null,
      created_at: String(row.created_at),
    }));

    return NextResponse.json({ success: true, data: { keys } });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memuat daftar API key', 500);
  }
}

/**
 * POST /api/api-keys — Create a new API key (admin-only).
 *
 * Body: { app_name: string, allowed_origins?: string }
 *
 * Generates a random key, hashes it with bcrypt, stores the hash + prefix,
 * and returns the raw key ONCE. The raw key cannot be retrieved later.
 *
 * Requirements: 18.3
 */
export async function POST(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  try {
    const body = await request.json();
    const appName = (body.app_name ?? '').trim();
    const allowedOrigins = (body.allowed_origins ?? '').trim() || null;

    if (!appName) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Nama aplikasi (app_name) wajib diisi',
        422,
      );
    }

    // Generate the raw key
    const rawKey = generateApiKey();

    // Extract the first 8 characters as the key prefix for identification
    const keyPrefix = rawKey.slice(0, 8);

    // Hash the full key with bcrypt for secure storage
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

    // Store in database
    const result = await queryOne<{ id: string; created_at: string }>(
      `INSERT INTO api_keys (key_hash, key_prefix, app_name, created_by, allowed_origins)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [keyHash, keyPrefix, appName, admin.id, allowedOrigins],
    );

    // Log the creation
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        admin.id,
        'admin',
        'api_key_created',
        'api_key',
        result?.id ?? null,
        JSON.stringify({ app_name: appName, key_prefix: keyPrefix }),
      ],
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result?.id,
        key_prefix: keyPrefix,
        app_name: appName,
        allowed_origins: allowedOrigins,
        is_active: true,
        created_at: result?.created_at ? String(result.created_at) : new Date().toISOString(),
        raw_key: rawKey, // Returned ONCE — cannot be retrieved later
      },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal membuat API key', 500);
  }
}

/**
 * DELETE /api/api-keys — Revoke (deactivate) an API key (admin-only).
 *
 * Body: { id: string }
 *
 * Sets is_active = false. The key record is preserved for audit purposes.
 *
 * Requirements: 18.3
 */
export async function DELETE(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  try {
    const body = await request.json();
    const keyId = (body.id ?? '').trim();

    if (!keyId) {
      return errorResponse('VALIDATION_ERROR', 'ID API key wajib diisi', 422);
    }

    // Check the key exists and is currently active
    const existing = await queryOne<{ id: string; app_name: string; key_prefix: string }>(
      `SELECT id, app_name, key_prefix FROM api_keys WHERE id = $1`,
      [keyId],
    );

    if (!existing) {
      return errorResponse('RESOURCE_NOT_FOUND', 'API key tidak ditemukan', 404);
    }

    // Deactivate the key
    await execute(
      `UPDATE api_keys SET is_active = false WHERE id = $1`,
      [keyId],
    );

    // Log the revocation
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        admin.id,
        'admin',
        'api_key_revoked',
        'api_key',
        keyId,
        JSON.stringify({ app_name: existing.app_name, key_prefix: existing.key_prefix }),
      ],
    );

    return NextResponse.json({
      success: true,
      data: { id: keyId, is_active: false },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal merevoke API key', 500);
  }
}
