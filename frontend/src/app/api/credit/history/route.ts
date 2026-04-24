import { NextResponse } from 'next/server';
import { query, queryOne } from '@shared/db';
import { withCreditApiMiddleware } from '@/lib/creditApiMiddleware';
import type { User, CreditTransaction } from '@shared/types';

/**
 * GET /api/credit/history — Read credit transaction history by user_id.
 * External API endpoint authenticated via X-API-Key header.
 *
 * Query params:
 *   - user_id: UUID of the user (required)
 *   - limit: number of transactions to return (optional, default 50, max 100)
 *   - offset: pagination offset (optional, default 0)
 *
 * Requirements: 18.1
 */
export const GET = withCreditApiMiddleware(async (ctx) => {
  try {
    const { searchParams } = new URL(ctx.request.url);
    const userId = searchParams.get('user_id');

    // Validate user_id
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'VALIDATION_ERROR',
            message: 'Parameter user_id diperlukan',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 422 },
      );
    }

    // Parse pagination params
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    let limit = 50;
    let offset = 0;

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        offset = parsed;
      }
    }

    // Verify user exists
    const user = await queryOne<User>(
      `SELECT id FROM users WHERE id = $1`,
      [userId],
    );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'RESOURCE_NOT_FOUND',
            message: 'Pengguna tidak ditemukan',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 },
      );
    }

    // Fetch transaction history
    const result = await query<CreditTransaction>(
      `SELECT id, user_id, amount, transaction_type, source_type, source_id, description, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    // Get total count for pagination
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = $1`,
      [userId],
    );

    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const formatDate = (val: unknown): string => {
      if (val instanceof Date) return val.toISOString();
      return val ? String(val) : '';
    };

    const transactions = result.rows.map((tx) => ({
      id: tx.id,
      user_id: tx.user_id,
      amount: tx.amount,
      transaction_type: tx.transaction_type,
      source_type: tx.source_type,
      source_id: tx.source_id,
      description: tx.description,
      created_at: formatDate(tx.created_at),
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit,
          offset,
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Gagal memuat riwayat transaksi credit',
          details: null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 },
    );
  }
});
