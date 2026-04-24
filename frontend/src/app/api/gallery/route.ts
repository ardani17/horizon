import { NextRequest, NextResponse } from 'next/server';
import { query } from '@shared/db';

interface MediaRow {
  id: string;
  file_url: string;
  media_type: string;
  created_at: Date;
  article_title: string | null;
  article_slug: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '18', 10) || 18));

  try {
    const result = await query<MediaRow>(
      `SELECT m.id, m.file_url, m.media_type, m.created_at,
              a.title AS article_title, a.slug AS article_slug
       FROM media m
       LEFT JOIN articles a ON m.article_id = a.id AND a.status = 'published'
       ORDER BY m.created_at DESC
       OFFSET $1 LIMIT $2`,
      [offset, limit]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      file_url: row.file_url,
      media_type: row.media_type,
      article_title: row.article_title,
      article_slug: row.article_slug,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    }));

    return NextResponse.json({
      success: true,
      data: { items },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Gagal memuat media gallery',
          details: null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
