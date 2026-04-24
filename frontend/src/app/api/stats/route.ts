import { NextRequest, NextResponse } from 'next/server';
import { query } from '@shared/db';

/**
 * GET /api/stats
 *
 * Returns dashboard statistics for the admin panel.
 * Supports query params:
 *   - range: 'day' | 'week' | 'month' (default: 'month')
 *   - period: number of periods to look back (default: 12)
 *
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || 'month';
  const period = Math.min(
    365,
    Math.max(1, parseInt(searchParams.get('period') || '12', 10) || 12),
  );

  try {
    // --- Summary cards ---
    const summaryResult = await query<{
      total_members: string;
      total_articles: string;
      total_media: string;
      total_credits: string;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'member') AS total_members,
        (SELECT COUNT(*) FROM articles WHERE status = 'published') AS total_articles,
        (SELECT COUNT(*) FROM media) AS total_media,
        (SELECT COALESCE(SUM(credit_balance), 0) FROM users) AS total_credits`,
    );

    const summary = summaryResult.rows[0];

    // --- Publication activity chart ---
    let truncUnit: string;
    let intervalExpr: string;

    if (range === 'day') {
      truncUnit = 'day';
      intervalExpr = `${period} days`;
    } else if (range === 'week') {
      truncUnit = 'week';
      intervalExpr = `${period * 7} days`;
    } else {
      truncUnit = 'month';
      intervalExpr = `${period} months`;
    }

    const activityResult = await query<{
      period_label: string;
      count: string;
    }>(
      `SELECT
        TO_CHAR(DATE_TRUNC($1, created_at), 
          CASE 
            WHEN $1 = 'day' THEN 'YYYY-MM-DD'
            WHEN $1 = 'week' THEN 'YYYY-"W"IW'
            ELSE 'YYYY-MM'
          END
        ) AS period_label,
        COUNT(*) AS count
      FROM articles
      WHERE status = 'published'
        AND created_at >= NOW() - CAST($2 AS INTERVAL)
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY DATE_TRUNC($1, created_at) ASC`,
      [truncUnit, intervalExpr],
    );

    // --- Category distribution ---
    const categoryResult = await query<{
      category: string;
      count: string;
    }>(
      `SELECT category, COUNT(*) AS count
       FROM articles
       WHERE status = 'published'
       GROUP BY category
       ORDER BY count DESC`,
    );

    // --- Top contributors (most articles + highest credit) ---
    const topArticlesResult = await query<{
      user_id: string;
      username: string;
      article_count: string;
    }>(
      `SELECT u.id AS user_id, u.username, COUNT(a.id) AS article_count
       FROM users u
       JOIN articles a ON a.author_id = u.id AND a.status = 'published'
       WHERE a.created_at >= NOW() - CAST($1 AS INTERVAL)
       GROUP BY u.id, u.username
       ORDER BY article_count DESC
       LIMIT 5`,
      [intervalExpr],
    );

    const topCreditResult = await query<{
      user_id: string;
      username: string;
      credit_balance: string;
    }>(
      `SELECT id AS user_id, username, credit_balance
       FROM users
       WHERE role = 'member'
       ORDER BY credit_balance DESC
       LIMIT 5`,
    );

    // --- Active vs inactive members (30-day activity) ---
    const activeResult = await query<{
      active_members: string;
      total_members: string;
    }>(
      `SELECT
        (SELECT COUNT(DISTINCT author_id)
         FROM articles
         WHERE status = 'published'
           AND created_at >= NOW() - INTERVAL '30 days') AS active_members,
        (SELECT COUNT(*) FROM users WHERE role = 'member') AS total_members`,
    );

    const activeMembers = parseInt(activeResult.rows[0]?.active_members || '0', 10);
    const totalMembers = parseInt(activeResult.rows[0]?.total_members || '0', 10);
    const inactiveMembers = totalMembers - activeMembers;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalMembers: parseInt(summary.total_members, 10),
          totalArticles: parseInt(summary.total_articles, 10),
          totalMedia: parseInt(summary.total_media, 10),
          totalCredits: parseInt(summary.total_credits, 10),
        },
        activity: activityResult.rows.map((r) => ({
          label: r.period_label,
          count: parseInt(r.count, 10),
        })),
        categories: categoryResult.rows.map((r) => ({
          category: r.category,
          count: parseInt(r.count, 10),
        })),
        topContributors: {
          byArticles: topArticlesResult.rows.map((r) => ({
            userId: r.user_id,
            username: r.username,
            articleCount: parseInt(r.article_count, 10),
          })),
          byCredit: topCreditResult.rows.map((r) => ({
            userId: r.user_id,
            username: r.username,
            creditBalance: parseInt(r.credit_balance, 10),
          })),
        },
        memberActivity: {
          active: activeMembers,
          inactive: inactiveMembers,
          total: totalMembers,
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Gagal memuat statistik dashboard',
          details: null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 },
    );
  }
}
