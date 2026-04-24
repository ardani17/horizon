import { NextResponse } from 'next/server';
import { queryOne, execute, withTransaction } from '@shared/db';
import { withCreditApiMiddleware } from '@/lib/creditApiMiddleware';
import type { User, CreditTransaction } from '@shared/types';

/**
 * POST /api/credit/spend — Spend credit with atomic balance check.
 * External API endpoint authenticated via X-API-Key header.
 *
 * Uses SELECT ... FOR UPDATE within a transaction to prevent race conditions
 * on the balance check.
 *
 * Body: { user_id, amount, description }
 *   - user_id: UUID of the user (required)
 *   - amount: positive integer of credits to spend (required)
 *   - description: reason for spending (required)
 *
 * Requirements: 18.4, 18.5, 18.6
 */
export const POST = withCreditApiMiddleware(
  async (ctx) => {
    try {
      const body = await ctx.request.json();
      const { user_id, amount, description } = body;

      // Validate user_id
      if (!user_id || typeof user_id !== 'string') {
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

      // Validate amount — must be a positive integer
      if (
        amount === undefined ||
        amount === null ||
        typeof amount !== 'number' ||
        !Number.isInteger(amount) ||
        amount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error_code: 'VALIDATION_ERROR',
              message: 'Jumlah credit harus berupa bilangan bulat positif',
              details: null,
              timestamp: new Date().toISOString(),
            },
          },
          { status: 422 },
        );
      }

      // Validate description
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error_code: 'VALIDATION_ERROR',
              message: 'Deskripsi penggunaan credit diperlukan',
              details: null,
              timestamp: new Date().toISOString(),
            },
          },
          { status: 422 },
        );
      }

      // Atomic spend within a transaction using SELECT ... FOR UPDATE
      const result = await withTransaction(async (client) => {
        // Lock the user row to prevent concurrent balance modifications
        const user = await queryOne<User>(
          `SELECT id, telegram_id, username, credit_balance
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [user_id],
          client,
        );

        if (!user) {
          return { error: 'USER_NOT_FOUND' as const };
        }

        // Check sufficient balance
        if (user.credit_balance < amount) {
          return {
            error: 'INSUFFICIENT_BALANCE' as const,
            current_balance: user.credit_balance,
          };
        }

        // Insert credit transaction
        const transaction = await queryOne<CreditTransaction>(
          `INSERT INTO credit_transactions (user_id, amount, transaction_type, source_type, description)
           VALUES ($1, $2, 'spent', 'external_tool', $3)
           RETURNING *`,
          [user_id, -amount, description.trim()],
          client,
        );

        // Update user balance
        await execute(
          `UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2`,
          [amount, user_id],
          client,
        );

        return {
          error: null,
          transaction,
          remaining_balance: user.credit_balance - amount,
        };
      });

      // Handle transaction result
      if (result.error === 'USER_NOT_FOUND') {
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

      if (result.error === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json(
          {
            success: false,
            error: {
              error_code: 'CREDIT_INSUFFICIENT',
              message: 'Saldo credit tidak mencukupi',
              details: {
                current_balance: result.current_balance,
                requested_amount: amount,
              },
              timestamp: new Date().toISOString(),
            },
          },
          { status: 422 },
        );
      }

      const formatDate = (val: unknown): string => {
        if (val instanceof Date) return val.toISOString();
        return val ? String(val) : '';
      };

      const tx = result.transaction!;

      return NextResponse.json({
        success: true,
        data: {
          transaction_id: tx.id,
          user_id: tx.user_id,
          amount: amount,
          remaining_balance: result.remaining_balance,
          transaction_type: tx.transaction_type,
          source_type: tx.source_type,
          created_at: formatDate(tx.created_at),
        },
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'INTERNAL_ERROR',
            message: 'Gagal memproses pengeluaran credit',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 },
      );
    }
  },
  { isSpendEndpoint: true },
);
