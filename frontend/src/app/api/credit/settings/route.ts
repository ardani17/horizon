import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';
import type { CreditSettings } from '@shared/types';

/**
 * GET /api/credit/settings — Fetch all credit settings.
 * Admin-only endpoint.
 *
 * Requirements: 17.1
 */
export async function GET() {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  try {
    const result = await query<CreditSettings>(
      `SELECT id, category, credit_reward, is_active, updated_at
       FROM credit_settings
       ORDER BY category ASC`,
    );

    const settings = result.rows.map((row) => ({
      id: row.id,
      category: row.category,
      credit_reward: row.credit_reward,
      is_active: row.is_active,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));

    return NextResponse.json({ success: true, data: { settings } });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memuat pengaturan credit', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/credit/settings — Update credit settings for a category.
 * Admin-only endpoint.
 *
 * Body: { id, credit_reward, is_active }
 *
 * Requirements: 17.2, 17.3
 */
export async function PUT(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { id, credit_reward, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'ID pengaturan diperlukan', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    if (credit_reward === undefined || credit_reward === null || typeof credit_reward !== 'number' || credit_reward < 0) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Nilai credit reward harus berupa angka positif', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Status aktif harus berupa boolean', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Fetch existing setting for logging
    const existing = await queryOne<CreditSettings>(
      `SELECT * FROM credit_settings WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Pengaturan credit tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const updated = await queryOne<CreditSettings>(
      `UPDATE credit_settings
       SET credit_reward = $1, is_active = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [credit_reward, is_active, id],
    );

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'credit_settings_updated', 'setting', $2, $3)`,
      [
        admin.id,
        id,
        JSON.stringify({
          category: existing.category,
          old_credit_reward: existing.credit_reward,
          new_credit_reward: credit_reward,
          old_is_active: existing.is_active,
          new_is_active: is_active,
        }),
      ],
    );

    return NextResponse.json({
      success: true,
      data: {
        setting: updated ? {
          id: updated.id,
          category: updated.category,
          credit_reward: updated.credit_reward,
          is_active: updated.is_active,
          updated_at: updated.updated_at instanceof Date ? updated.updated_at.toISOString() : String(updated.updated_at),
        } : null,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memperbarui pengaturan credit', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
