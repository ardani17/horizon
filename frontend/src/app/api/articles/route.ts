import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';
import { slugify, extractFirstWords } from '@shared/utils/slugify';
import type { Article } from '@shared/types';

interface ArticleRow extends Article {
  author_username: string | null;
  media_count: string;
}

/**
 * GET /api/articles — List articles with pagination, search, and filters.
 * Admin-only endpoint.
 *
 * Query params:
 *   page (default 1), pageSize (default 20), search, status, category
 *
 * Requirements: 5.1
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
  const statusFilter = params.get('status') || '';
  const categoryFilter = params.get('category') || '';
  const offset = (page - 1) * pageSize;

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(a.title ILIKE $${paramIndex} OR a.content_html ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (statusFilter) {
      conditions.push(`a.status = $${paramIndex}`);
      values.push(statusFilter);
      paramIndex++;
    }

    if (categoryFilter) {
      conditions.push(`a.category = $${paramIndex}`);
      values.push(categoryFilter);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      query<ArticleRow>(
        `SELECT a.*, u.username AS author_username,
                (SELECT COUNT(*) FROM media m WHERE m.article_id = a.id) AS media_count
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM articles a ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const articles = dataResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      content_type: row.content_type,
      source: row.source,
      status: row.status,
      slug: row.slug,
      author_username: row.author_username,
      media_count: parseInt(String(row.media_count), 10),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    return NextResponse.json({
      success: true,
      data: { articles, total, page, pageSize },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memuat daftar artikel', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/articles — Create a new article from the admin dashboard.
 *
 * Body: { title, content_html, category, content_type, status }
 *
 * Requirements: 6.1, 6.2
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
    const { title, content_html, category, content_type, status } = body;

    if (!content_html || typeof content_html !== 'string' || !content_html.trim()) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Konten HTML tidak boleh kosong', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    const validCategories = ['trading', 'life_story', 'general', 'outlook'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Kategori tidak valid', details: { valid: validCategories }, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Generate slug from title or content
    const slugInput = title?.trim() || extractFirstWords(content_html.replace(/<[^>]*>/g, ''), 8);
    const slug = slugify(slugInput);

    const article = await queryOne<Article>(
      `INSERT INTO articles (author_id, content_html, title, category, content_type, source, status, slug)
       VALUES ($1, $2, $3, $4, $5, 'dashboard', $6, $7)
       RETURNING *`,
      [admin.id, content_html, title?.trim() || null, category, content_type || 'short', status || 'published', slug],
    );

    if (!article) {
      return NextResponse.json(
        { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal membuat artikel', details: null, timestamp: new Date().toISOString() } },
        { status: 500 },
      );
    }

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'article_created', 'article', $2, $3)`,
      [admin.id, article.id, JSON.stringify({ title: article.title, category: article.category, source: 'dashboard' })],
    );

    return NextResponse.json({ success: true, data: { article } }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal membuat artikel', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
