import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';
import type { User, CreditTransaction, Article } from '@shared/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UserProfile extends User {
  total_articles: string;
  articles_trading: string;
  articles_life_story: string;
  articles_general: string;
  articles_outlook: string;
  first_article_at: string | null;
  last_article_at: string | null;
}

/**
 * GET /api/users/[id] — Fetch a single user profile with stats.
 * Admin-only endpoint.
 *
 * Requirements: 22.6, 22.7, 22.8
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    // Fetch user with article stats
    const user = await queryOne<UserProfile>(
      `SELECT u.*,
              (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published') AS total_articles,
              (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published' AND a.category = 'trading') AS articles_trading,
              (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published' AND a.category = 'life_story') AS articles_life_story,
              (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published' AND a.category = 'general') AS articles_general,
              (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published' AND a.category = 'outlook') AS articles_outlook,
              (SELECT MIN(a.created_at) FROM articles a WHERE a.author_id = u.id AND a.status = 'published') AS first_article_at,
              (SELECT MAX(a.created_at) FROM articles a WHERE a.author_id = u.id AND a.status = 'published') AS last_article_at
       FROM users u
       WHERE u.id = $1`,
      [id],
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Pengguna tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    // Calculate avg articles per month
    const firstArticleAt = user.first_article_at ? new Date(user.first_article_at) : null;
    const totalArticles = parseInt(String(user.total_articles), 10);
    let avgArticlesPerMonth = 0;

    if (firstArticleAt && totalArticles > 0) {
      const monthsDiff = Math.max(
        1,
        (Date.now() - firstArticleAt.getTime()) / (1000 * 60 * 60 * 24 * 30),
      );
      avgArticlesPerMonth = Math.round((totalArticles / monthsDiff) * 10) / 10;
    }

    // Fetch recent articles
    const articlesResult = await query<Article & { media_count: string }>(
      `SELECT a.*,
              (SELECT COUNT(*) FROM media m WHERE m.article_id = a.id) AS media_count
       FROM articles a
       WHERE a.author_id = $1 AND a.status = 'published'
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [id],
    );

    // Fetch credit transaction history
    const transactionsResult = await query<CreditTransaction>(
      `SELECT * FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id],
    );

    const formatDate = (val: unknown): string => {
      if (val instanceof Date) return val.toISOString();
      return val ? String(val) : '';
    };

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          telegram_id: user.telegram_id ? String(user.telegram_id) : null,
          username: user.username,
          role: user.role,
          credit_balance: user.credit_balance,
          created_at: formatDate(user.created_at),
        },
        stats: {
          totalArticles,
          articlesByCategory: {
            trading: parseInt(String(user.articles_trading), 10),
            life_story: parseInt(String(user.articles_life_story), 10),
            general: parseInt(String(user.articles_general), 10),
            outlook: parseInt(String(user.articles_outlook), 10),
          },
          avgArticlesPerMonth,
          lastPublishedAt: user.last_article_at ? formatDate(user.last_article_at) : null,
        },
        articles: articlesResult.rows.map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          status: a.status,
          slug: a.slug,
          media_count: parseInt(String((a as unknown as { media_count: string }).media_count), 10),
          created_at: formatDate(a.created_at),
        })),
        transactions: transactionsResult.rows.map((t) => ({
          id: t.id,
          amount: t.amount,
          transaction_type: t.transaction_type,
          source_type: t.source_type,
          description: t.description,
          created_at: formatDate(t.created_at),
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memuat profil pengguna', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/users/[id] — Update a user (role change).
 * Admin-only endpoint.
 *
 * Body: { role }
 *
 * Requirements: 7.2
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const existing = await queryOne<User>(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Pengguna tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Role diperlukan', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    const validRoles = ['member', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Role tidak valid', details: { valid: validRoles }, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Prevent admin from demoting themselves
    if (existing.id === admin.id && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Tidak dapat mengubah role akun sendiri', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    const updated = await queryOne<User>(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING *`,
      [role, id],
    );

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'user_role_changed', 'user', $2, $3)`,
      [admin.id, id, JSON.stringify({ old_role: existing.role, new_role: role, username: existing.username })],
    );

    return NextResponse.json({
      success: true,
      data: {
        user: updated ? {
          id: updated.id,
          telegram_id: updated.telegram_id ? String(updated.telegram_id) : null,
          username: updated.username,
          role: updated.role,
          credit_balance: updated.credit_balance,
          created_at: updated.created_at instanceof Date ? updated.created_at.toISOString() : String(updated.created_at),
        } : null,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memperbarui pengguna', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
