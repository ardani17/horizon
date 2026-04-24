import { NextRequest, NextResponse } from 'next/server';
import { query } from '@shared/db';
import { validateSession } from '@/lib/auth';

interface UserRow {
  id: string;
  telegram_id: string | null;
  username: string | null;
  role: string;
  credit_balance: string;
  created_at: string;
  article_count: string;
}

/**
 * GET /api/users — List all users with pagination, search, and role filter.
 * Admin-only endpoint.
 *
 * Query params:
 *   page (default 1), pageSize (default 20), search, role
 *
 * Requirements: 7.1, 22.6
 */
export async function GET(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '20', 10) || 20));
  const search = params.get('search')?.trim() || '';
  const roleFilter = params.get('role') || '';
  const offset = (page - 1) * pageSize;

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR CAST(u.telegram_id AS TEXT) ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (roleFilter) {
      conditions.push(`u.role = $${paramIndex}`);
      values.push(roleFilter);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      query<UserRow>(
        `SELECT u.id, u.telegram_id, u.username, u.role, u.credit_balance, u.created_at,
                (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published') AS article_count
         FROM users u
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users u ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const users = dataResult.rows.map((row) => ({
      id: row.id,
      telegram_id: row.telegram_id ? String(row.telegram_id) : null,
      username: row.username,
      role: row.role,
      credit_balance: parseInt(String(row.credit_balance), 10),
      article_count: parseInt(String(row.article_count), 10),
      created_at: String(row.created_at),
    }));

    return NextResponse.json({
      success: true,
      data: { users, total, page, pageSize },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memuat daftar pengguna', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
