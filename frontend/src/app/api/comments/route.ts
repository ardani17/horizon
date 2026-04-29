import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { query, queryOne } from '@shared/db';
import { validateSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { RATE_LIMITS } from '@shared/constants';

interface CommentRow {
  id: string;
  display_name: string;
  content: string;
  is_anonymous: boolean;
  created_at: Date;
  user_id: string | null;
}

interface UserRow {
  id: string;
  username: string | null;
}

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verify Telegram Login Widget data using HMAC-SHA256.
 */
function verifyTelegramAuth(authData: TelegramAuthData): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const { hash, ...data } = authData;

  const checkString = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHash('sha256').update(botToken).digest();
  const hmac = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return hmac === hash;
}

function isTelegramAuthFresh(authDate: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 86400;
  return now - authDate < maxAge;
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

interface AdminCommentRow {
  id: string;
  article_id: string;
  article_title: string | null;
  article_slug: string;
  display_name: string;
  content: string;
  is_anonymous: boolean;
  status: string;
  created_at: Date;
  user_id: string | null;
}

/**
 * Admin listing: all comments with article reference, pagination, search, and status filter.
 */
async function handleAdminList(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '20', 10) || 20));
  const search = params.get('search')?.trim() || '';
  const statusFilter = params.get('status') || '';
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`(c.content ILIKE $${idx} OR c.display_name ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }

  if (statusFilter) {
    conditions.push(`c.status = $${idx}`);
    values.push(statusFilter);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [dataResult, countResult] = await Promise.all([
    query<AdminCommentRow>(
      `SELECT c.id, c.article_id, a.title AS article_title, a.slug AS article_slug,
              c.display_name, c.content, c.is_anonymous, c.status, c.created_at, c.user_id
       FROM comments c
       LEFT JOIN articles a ON c.article_id = a.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSize, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM comments c ${whereClause}`,
      values,
    ),
  ]);

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  const comments = dataResult.rows.map((row) => ({
    id: row.id,
    article_id: row.article_id,
    article_title: row.article_title,
    article_slug: row.article_slug,
    display_name: row.display_name,
    content: row.content,
    is_anonymous: row.is_anonymous,
    status: row.status,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    user_id: row.user_id,
  }));

  return NextResponse.json({
    success: true,
    data: { comments, total, page, pageSize },
  });
}

/**
 * GET /api/comments?article_id={id}
 *
 * Public mode: visible comments for a specific article (oldest first).
 * Admin mode: all comments with pagination (admin=true query param).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get('admin') === 'true';

    if (isAdmin) {
      return handleAdminList(request);
    }

    const articleId = searchParams.get('article_id');
    if (!articleId) {
      return errorResponse('VALIDATION_ERROR', 'article_id diperlukan', 422);
    }

    const result = await query<CommentRow>(
      `SELECT id, display_name, content, is_anonymous, created_at, user_id
       FROM comments
       WHERE article_id = $1 AND status = $2
       ORDER BY created_at ASC`,
      [articleId, 'visible'],
    );

    const comments = result.rows.map((row) => ({
      id: row.id,
      display_name: row.display_name,
      content: row.content,
      is_anonymous: row.is_anonymous,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      user_id: row.user_id,
    }));

    return NextResponse.json({ success: true, data: comments });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memuat komentar', 500);
  }
}

/**
 * POST /api/comments — Create a new comment on an article.
 */
export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, {
    max: RATE_LIMITS.COMMENTS_MAX,
    windowMs: RATE_LIMITS.WINDOW_MS,
    prefix: 'comments',
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { article_id, content, is_anonymous, display_name, telegram_auth } = body;

    if (!article_id) {
      return errorResponse('VALIDATION_ERROR', 'article_id diperlukan', 422);
    }

    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    if (!trimmedContent) {
      return errorResponse('VALIDATION_ERROR', 'Isi komentar tidak boleh kosong', 422);
    }

    if (trimmedContent.length > 2000) {
      return errorResponse('VALIDATION_ERROR', 'Komentar maksimal 2000 karakter', 422);
    }

    let userId: string | null = null;
    let commentDisplayName = 'Anonim';
    let commentIsAnonymous = true;

    if (!is_anonymous && telegram_auth) {
      const authData = telegram_auth as TelegramAuthData;

      if (!verifyTelegramAuth(authData)) {
        return errorResponse('AUTH_INVALID', 'Verifikasi Telegram gagal', 401);
      }

      if (!isTelegramAuthFresh(authData.auth_date)) {
        return errorResponse('AUTH_INVALID', 'Sesi Telegram telah kedaluwarsa. Silakan login ulang.', 401);
      }

      let user = await queryOne<UserRow>(
        `SELECT id, username FROM users WHERE telegram_id = $1`,
        [authData.id],
      );

      if (!user) {
        const username = authData.username || authData.first_name;
        const result = await query<UserRow>(
          `INSERT INTO users (telegram_id, username, role)
           VALUES ($1, $2, $3)
           RETURNING id, username`,
          [authData.id, username, 'member'],
        );
        user = result.rows[0] || null;
      }

      if (user) {
        userId = user.id;
        commentDisplayName = authData.username
          ? `@${authData.username}`
          : authData.first_name;
        commentIsAnonymous = false;
      }
    } else {
      commentDisplayName =
        typeof display_name === 'string' && display_name.trim()
          ? display_name.trim().slice(0, 100)
          : 'Anonim';
      commentIsAnonymous = true;
    }

    const result = await query<CommentRow>(
      `INSERT INTO comments (article_id, user_id, display_name, content, is_anonymous, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, display_name, content, is_anonymous, created_at, user_id`,
      [article_id, userId, commentDisplayName, trimmedContent, commentIsAnonymous, 'visible'],
    );

    const comment = result.rows[0];
    if (!comment) {
      return errorResponse('INTERNAL_ERROR', 'Gagal menyimpan komentar', 500);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: comment.id,
          display_name: comment.display_name,
          content: comment.content,
          is_anonymous: comment.is_anonymous,
          created_at:
            comment.created_at instanceof Date
              ? comment.created_at.toISOString()
              : String(comment.created_at),
          user_id: comment.user_id,
        },
      },
      { status: 201 },
    );
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal mengirim komentar', 500);
  }
}
