import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';
import type { Article, Media } from '@shared/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/articles/[id] — Fetch a single article with its media.
 * Admin-only endpoint.
 *
 * Requirements: 5.2
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
    const article = await queryOne<Article & { author_username: string | null }>(
      `SELECT a.*, u.username AS author_username
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.id = $1`,
      [id],
    );

    if (!article) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Artikel tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const mediaResult = await query<Media>(
      `SELECT * FROM media WHERE article_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    return NextResponse.json({
      success: true,
      data: {
        article: {
          ...article,
          created_at: article.created_at instanceof Date ? article.created_at.toISOString() : String(article.created_at),
        },
        media: mediaResult.rows.map((m) => ({
          ...m,
          created_at: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memuat artikel', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/articles/[id] — Update an article.
 * Admin-only endpoint.
 *
 * Body: { title, content_html, category, status }
 *
 * Requirements: 5.2, 5.3
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
    // Check article exists
    const existing = await queryOne<Article>(
      `SELECT * FROM articles WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Artikel tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { title, content_html, category, status } = body;

    // Build update fields dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title?.trim() || null);
      paramIndex++;
    }

    if (content_html !== undefined) {
      if (!content_html || typeof content_html !== 'string' || !content_html.trim()) {
        return NextResponse.json(
          { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Konten HTML tidak boleh kosong', details: null, timestamp: new Date().toISOString() } },
          { status: 422 },
        );
      }
      updates.push(`content_html = $${paramIndex}`);
      values.push(content_html);
      paramIndex++;
    }

    if (category !== undefined) {
      const validCategories = ['trading', 'life_story', 'general', 'outlook', 'blog'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Kategori tidak valid', details: { valid: validCategories }, timestamp: new Date().toISOString() } },
          { status: 422 },
        );
      }
      updates.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (status !== undefined) {
      const validStatuses = ['published', 'hidden', 'draft'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Status tidak valid', details: { valid: validStatuses }, timestamp: new Date().toISOString() } },
          { status: 422 },
        );
      }
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'Tidak ada field yang diperbarui', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    values.push(id);
    const updated = await queryOne<Article>(
      `UPDATE articles SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'article_updated', 'article', $2, $3)`,
      [admin.id, id, JSON.stringify({ changes: Object.keys(body), old_status: existing.status, new_status: status ?? existing.status })],
    );

    return NextResponse.json({
      success: true,
      data: {
        article: updated ? {
          ...updated,
          created_at: updated.created_at instanceof Date ? updated.created_at.toISOString() : String(updated.created_at),
        } : null,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal memperbarui artikel', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/articles/[id] — Delete an article and cascade delete media from DB + R2.
 * Admin-only endpoint.
 *
 * Requirements: 5.4
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    // Check article exists
    const existing = await queryOne<Article>(
      `SELECT * FROM articles WHERE id = $1`,
      [id],
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { error_code: 'RESOURCE_NOT_FOUND', message: 'Artikel tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    // Fetch media to delete from R2
    const mediaResult = await query<Media>(
      `SELECT * FROM media WHERE article_id = $1`,
      [id],
    );

    // Delete media from R2 (best effort)
    const mediaKeys = mediaResult.rows
      .map((m) => m.file_key)
      .filter((key): key is string => !!key);

    if (mediaKeys.length > 0) {
      try {
        const { S3Client, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
          region: 'auto',
          endpoint: process.env.R2_ENDPOINT || '',
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
          },
        });

        await s3.send(new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME || '',
          Delete: {
            Objects: mediaKeys.map((key) => ({ Key: key })),
          },
        }));
      } catch {
        // Log R2 deletion failure but continue with DB deletion
        console.error('[DELETE /api/articles] Failed to delete media from R2:', mediaKeys);
      }
    }

    // Delete article (media cascade-deletes via ON DELETE CASCADE)
    await execute(`DELETE FROM articles WHERE id = $1`, [id]);

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'article_deleted', 'article', $2, $3)`,
      [admin.id, id, JSON.stringify({ title: existing.title, category: existing.category, media_deleted: mediaKeys.length })],
    );

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal menghapus artikel', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
