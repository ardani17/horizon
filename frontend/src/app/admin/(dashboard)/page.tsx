import { query } from '@shared/db';
import { StatsCards } from '@/components/admin/StatsCards';
import type { StatsSummary } from '@/components/admin/StatsCards';
import { DashboardClientWidgets } from './DashboardClientWidgets';

/**
 * Admin Dashboard Home Page
 *
 * Server component that fetches summary statistics and renders
 * the dashboard with stat cards and interactive charts.
 *
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5
 */
export default async function AdminDashboardPage() {
  let summary: StatsSummary = {
    totalMembers: 0,
    totalArticles: 0,
    totalMedia: 0,
    totalCredits: 0,
  };

  try {
    const result = await query<{
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

    const row = result.rows[0];
    if (row) {
      summary = {
        totalMembers: parseInt(row.total_members, 10),
        totalArticles: parseInt(row.total_articles, 10),
        totalMedia: parseInt(row.total_media, 10),
        totalCredits: parseInt(row.total_credits, 10),
      };
    }
  } catch {
    // Fall back to zeros — cards will show 0
  }

  return (
    <div>
      <h2>Dashboard</h2>
      <StatsCards summary={summary} />
      <DashboardClientWidgets />
    </div>
  );
}
