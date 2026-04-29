import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@shared/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { RATE_LIMITS } from '@shared/constants';

interface LikeRow {
  id: string;
}

interface CountRow {
  count: string;
}

/**
 * GET /api/likes?article_id=xxx&fingerprint=yyy — Get like count and liked status.
 *
 * Query params:
 *   article_id (required) — The article UUID
 *   fingerprint (optional) — If provided, also returns whether this fingerprint liked the article
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const article_id = params.get('article_id');
    const fingerprint = params.get('fingerprint');

    if (!article_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'VALIDATION_ERROR',
            message: 'article_id diperlukan',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 422 }
      );
    }

    const countResult = await queryOne<CountRow>(
      `SELECT COUNT(*)::text AS count FROM likes WHERE article_id = $1`,
      [article_id]
    );

    const likeCount = parseInt(countResult?.count || '0', 10);

    let liked = false;
    if (fingerprint) {
      const existing = await queryOne<LikeRow>(
        `SELECT id FROM likes WHERE article_id = $1 AND fingerprint = $2`,
        [article_id, fingerprint]
      );
      liked = !!existing;
    }

    return NextResponse.json({
      success: true,
      data: {
        liked,
        like_count: likeCount,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Gagal memuat data like',
          details: null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/likes — Toggle like for an article.
 *
 * Body: { article_id: string, fingerprint: string }
 *
 * Uses the UNIQUE(article_id, fingerprint) constraint to enforce
 * one like per fingerprint per article. If the like already exists,
 * it is removed (unlike). Otherwise a new like is inserted.
 */
export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, {
    max: RATE_LIMITS.LIKES_MAX,
    windowMs: RATE_LIMITS.WINDOW_MS,
    prefix: 'likes',
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { article_id, fingerprint } = body;

    if (!article_id || !fingerprint) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error_code: 'VALIDATION_ERROR',
            message: 'article_id dan fingerprint diperlukan',
            details: null,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 422 }
      );
    }

    // Check if like already exists
    const existing = await queryOne<LikeRow>(
      `SELECT id FROM likes WHERE article_id = $1 AND fingerprint = $2`,
      [article_id, fingerprint]
    );

    let liked: boolean;

    if (existing) {
      // Unlike — remove the existing like
      await query(
        `DELETE FROM likes WHERE article_id = $1 AND fingerprint = $2`,
        [article_id, fingerprint]
      );
      liked = false;
    } else {
      // Like — insert new like
      await query(
        `INSERT INTO likes (article_id, fingerprint) VALUES ($1, $2)`,
        [article_id, fingerprint]
      );
      liked = true;
    }

    // Get updated like count
    const countResult = await queryOne<CountRow>(
      `SELECT COUNT(*)::text AS count FROM likes WHERE article_id = $1`,
      [article_id]
    );

    const likeCount = parseInt(countResult?.count || '0', 10);

    return NextResponse.json({
      success: true,
      data: {
        liked,
        like_count: likeCount,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Gagal memproses like',
          details: null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
