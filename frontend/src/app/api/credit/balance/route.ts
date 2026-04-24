import { NextResponse } from 'next/server';
import { queryOne } from '@shared/db';
import { withCreditApiMiddleware } from '@/lib/creditApiMiddleware';
import type { User } from '@shared/types';

/**
 * GET /api/credit/balance — Read credit balance by user_id or telegram_id.
 * External API endpoint authenticated via X-API-Key header.
 *
 * Query params:
 *   - user_id: UUID of the user
 *   - telegram_id: Telegram ID of the user
 *   (one of the two is required)
 *
 * Requirements: 18.1
 */
export const GET = withCreditApiMiddleware(async (ctx) => {
  try {
    const { searchParams } = new URL(ctx.request.url);
    const userId = searchParams.get('user_id');
    const telegramId = searchParams.get('telegram_id');

    // Validate that at least one identifier is provided
    if (!userId && !telegramId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'VALIDATION_ERROR',
            message: 'Parameter user_id atau telegram_id diperlukan',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 422 },
      );
    }

    // Look up user by user_id or telegram_id
    let user: User | null = null;

    if (userId) {
      user = await queryOne<User>(
        `SELECT id, telegram_id, username, role, credit_balance, created_at
         FROM users WHERE id = $1`,
        [userId],
      );
    } else if (telegramId) {
      user = await queryOne<User>(
        `SELECT id, telegram_id, username, role, credit_balance, created_at
         FROM users WHERE telegram_id = $1`,
        [telegramId],
      );
    }

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

    return NextResponse.json({
      success: true,
      data: {
        user_id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        credit_balance: user.credit_balance,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Gagal membaca saldo credit',
          details: null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 },
    );
  }
});
