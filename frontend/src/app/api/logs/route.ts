import { NextRequest, NextResponse } from 'next/server';
import { query } from '@shared/db';
import { validateSession } from '@/lib/auth';

interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  actor_username: string | null;
}

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
 * GET /api/logs — List activity logs with filters and search.
 * Admin-only endpoint.
 *
 * Query params:
 *   page (default 1), pageSize (default 30)
 *   search — keyword search across action and details (JSONB cast to text)
 *   actor_id — filter by specific actor UUID
 *   action — filter by action type
 *   target_type — filter by target type
 *   from — ISO date string for start of time range
 *   to — ISO date string for end of time range
 *
 * Requirements: 23.3, 23.4, 23.5, 23.6
 */
export async function GET(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '30', 10) || 30));
  const search = params.get('search')?.trim() || '';
  const actorId = params.get('actor_id')?.trim() || '';
  const actionFilter = params.get('action')?.trim() || '';
  const targetTypeFilter = params.get('target_type')?.trim() || '';
  const fromDate = params.get('from')?.trim() || '';
  const toDate = params.get('to')?.trim() || '';
  const offset = (page - 1) * pageSize;

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (search) {
      conditions.push(
        `(al.action ILIKE $${idx} OR CAST(al.details AS TEXT) ILIKE $${idx})`,
      );
      values.push(`%${search}%`);
      idx++;
    }

    if (actorId) {
      conditions.push(`al.actor_id = $${idx}`);
      values.push(actorId);
      idx++;
    }

    if (actionFilter) {
      conditions.push(`al.action = $${idx}`);
      values.push(actionFilter);
      idx++;
    }

    if (targetTypeFilter) {
      conditions.push(`al.target_type = $${idx}`);
      values.push(targetTypeFilter);
      idx++;
    }

    if (fromDate) {
      conditions.push(`al.created_at >= $${idx}`);
      values.push(fromDate);
      idx++;
    }

    if (toDate) {
      conditions.push(`al.created_at <= $${idx}`);
      values.push(toDate);
      idx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      query<ActivityLogRow>(
        `SELECT al.id, al.actor_id, al.actor_type, al.action, al.target_type,
                al.target_id, al.details, al.ip_address, al.created_at,
                u.username AS actor_username
         FROM activity_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, pageSize, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM activity_logs al ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const logs = dataResult.rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_type: row.actor_type,
      actor_username: row.actor_username,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      details: row.details,
      ip_address: row.ip_address,
      created_at: String(row.created_at),
    }));

    // Also fetch distinct action types and target types for filter dropdowns
    const [actionsResult, targetTypesResult] = await Promise.all([
      query<{ action: string }>(
        `SELECT DISTINCT action FROM activity_logs ORDER BY action ASC`,
      ),
      query<{ target_type: string }>(
        `SELECT DISTINCT target_type FROM activity_logs WHERE target_type IS NOT NULL ORDER BY target_type ASC`,
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        total,
        page,
        pageSize,
        filters: {
          actions: actionsResult.rows.map((r) => r.action),
          targetTypes: targetTypesResult.rows.map((r) => r.target_type),
        },
      },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memuat activity logs', 500);
  }
}
