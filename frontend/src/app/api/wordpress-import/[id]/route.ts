// ============================================
// Horizon Trader Platform — WordPress Import Job Status API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@shared/db';
import { validateSession } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function errorResponse(code: string, message: string, status: number, details: Record<string, unknown> | null = null) {
  return NextResponse.json(
    {
      success: false,
      error: {
        error_code: code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}

/**
 * GET /api/wordpress-import/[id]
 *
 * Return a single import job by ID, joined with the users table
 * to include triggered_by_username.
 *
 * Requirements: 4.1
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  const { id } = await context.params;

  try {
    const job = await queryOne<{
      id: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      total_fetched: number;
      total_imported: number;
      total_skipped: number;
      total_failed: number;
      error_message: string | null;
      triggered_by_username: string;
    }>(
      `SELECT j.id, j.status, j.started_at, j.completed_at,
              j.total_fetched, j.total_imported, j.total_skipped, j.total_failed,
              j.error_message, u.username AS triggered_by_username
       FROM wordpress_import_jobs j
       JOIN users u ON j.triggered_by = u.id
       WHERE j.id = $1`,
      [id],
    );

    if (!job) {
      return errorResponse('RESOURCE_NOT_FOUND', 'Job impor tidak ditemukan', 404);
    }

    return NextResponse.json({
      success: true,
      data: {
        job,
      },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memproses permintaan', 500);
  }
}
