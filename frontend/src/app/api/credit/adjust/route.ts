import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, withTransaction } from '@shared/db';
import { validateSession } from '@/lib/auth';
import type { User, CreditTransaction } from '@shared/types';

/**
 * POST /api/credit/adjust — Manual credit adjustment by admin.
 * Creates a credit_transaction with transaction_type "adjusted" and source_type "manual_admin".
 * Admin-only endpoint.
 *
 * Body: { user_id, amount, description }
 *   - amount: positive to add, negative to subtract
 *   - description: reason for adjustment (required)
 *
 * Requirements: 17.4
 */
export async function POST(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { user_id, amount, description } = body;

    // Validate user_id
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'ID member diperlukan', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Validate amount
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount === 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Jumlah credit harus berupa bilangan bulat dan tidak boleh nol', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Deskripsi alasan penyesuaian diperlukan', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Check user exists
    const targetUser = await queryOne<User>(
      `SELECT id, username, credit_balance FROM users WHERE id = $1`,
      [user_id],
    );

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Member tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    // Check that subtraction won't result in negative balance
    if (amount < 0 && targetUser.credit_balance + amount < 0) {
      return NextResponse.json(
        { success: false, error: { error_code: 'CREDIT_INSUFFICIENT', message: 'Saldo credit tidak mencukupi untuk pengurangan ini', details: { current_balance: targetUser.credit_balance, requested_amount: amount }, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Perform atomic credit adjustment
    const transaction = await withTransaction(async (client) => {
      // Insert credit transaction
      const tx = await queryOne<CreditTransaction>(
        `INSERT INTO credit_transactions (user_id, amount, transaction_type, source_type, description)
         VALUES ($1, $2, 'adjusted', 'manual_admin', $3)
         RETURNING *`,
        [user_id, amount, description.trim()],
        client,
      );

      // Update user balance
      await execute(
        `UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2`,
        [amount, user_id],
        client,
      );

      return tx;
    });

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'credit_adjusted', 'credit', $2, $3)`,
      [
        admin.id,
        user_id,
        JSON.stringify({
          amount,
          description: description.trim(),
          username: targetUser.username,
          old_balance: targetUser.credit_balance,
          new_balance: targetUser.credit_balance + amount,
        }),
      ],
    );

    const formatDate = (val: unknown): string => {
      if (val instanceof Date) return val.toISOString();
      return val ? String(val) : '';
    };

    return NextResponse.json({
      success: true,
      data: {
        transaction: transaction ? {
          id: transaction.id,
          user_id: transaction.user_id,
          amount: transaction.amount,
          transaction_type: transaction.transaction_type,
          source_type: transaction.source_type,
          description: transaction.description,
          created_at: formatDate(transaction.created_at),
        } : null,
        new_balance: targetUser.credit_balance + amount,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal melakukan penyesuaian credit', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
