// ============================================
// Horizon Trader Platform — WordPress Import API
// ============================================

import { NextResponse } from 'next/server';
import { query, queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';
import { ActivityLogService } from '@shared/services/activityLog';
import { executeWordPressImport } from '@shared/services/wordpressImport';
import type { WordPressImportJob, ImportCounts } from '@shared/types';

const activityLog = new ActivityLogService();

function errorResponse(code: string, message: string, status: number, details: Record<string, unknown> | null = null) {
  return NextResponse.json(
    {
      success: false,
      error: {
        error_code: code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}

/**
 * GET /api/wordpress-import
 *
 * Return the 10 most recent import jobs ordered by started_at DESC,
 * joined with the users table to include triggered_by_username.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export async function GET() {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  try {
    const result = await query<{
      id: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      total_fetched: number;
      total_imported: number;
      total_skipped: number;
      total_failed: number;
      error_message: string | null;
      triggered_by_username: string;
    }>(
      `SELECT j.id, j.status, j.started_at, j.completed_at,
              j.total_fetched, j.total_imported, j.total_skipped, j.total_failed,
              j.error_message, u.username AS triggered_by_username
       FROM wordpress_import_jobs j
       JOIN users u ON j.triggered_by = u.id
       ORDER BY j.started_at DESC
       LIMIT 10`,
    );

    return NextResponse.json({
      success: true,
      data: {
        jobs: result.rows,
      },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memproses permintaan', 500);
  }
}

/**
 * POST /api/wordpress-import
 *
 * Trigger a new WordPress import job.
 *
 * Flow:
 * 1. Validate admin session
 * 2. Check for existing running jobs (return 409 if found)
 * 3. Create a new job record with status='running'
 * 4. Log wordpress_import_started to activity_logs
 * 5. Start async import execution (fire-and-forget)
 * 6. Return HTTP 202 with the job ID
 *
 * Requirements: 2.1, 2.3, 2.4, 2.5, 6.1, 7.1, 7.3
 */
export async function POST() {
  const admin = await validateSession();
  if (!admin) {
    return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
  }

  try {
    // Check for existing running jobs
    const runningJob = await queryOne<WordPressImportJob>(
      `SELECT id, status FROM wordpress_import_jobs WHERE status = 'running' LIMIT 1`,
    );

    if (runningJob) {
      return errorResponse(
        'IMPORT_ALREADY_RUNNING',
        'Impor sedang berjalan',
        409,
        { jobId: runningJob.id },
      );
    }

    // Create a new job record
    const newJob = await queryOne<WordPressImportJob>(
      `INSERT INTO wordpress_import_jobs (status, triggered_by)
       VALUES ('running', $1)
       RETURNING id`,
      [admin.id],
    );

    if (!newJob) {
      return errorResponse('INTERNAL_ERROR', 'Gagal membuat job impor', 500);
    }

    const jobId = newJob.id;

    // Log wordpress_import_started
    await activityLog.log({
      actor_id: admin.id,
      actor_type: 'admin',
      action: 'wordpress_import_started',
      target_type: 'article',
      details: { jobId },
    });

    // Start async import execution (fire-and-forget)
    runImportAsync(admin.id, jobId);

    return NextResponse.json(
      { success: true, data: { jobId } },
      { status: 202 },
    );
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memproses permintaan', 500);
  }
}

/**
 * Run the WordPress import asynchronously.
 *
 * This function is called fire-and-forget from the POST handler.
 * It updates the job record with progress, and on completion or
 * failure updates the final status and logs the outcome.
 *
 * Requirements: 2.5, 2.7, 2.8, 4.2, 6.2, 6.3
 */
function runImportAsync(adminId: string, jobId: string): void {
  const importPromise = async () => {
    try {
      const onProgress = async (counts: ImportCounts): Promise<void> => {
        await execute(
          `UPDATE wordpress_import_jobs
           SET total_fetched = $1, total_imported = $2, total_skipped = $3, total_failed = $4
           WHERE id = $5`,
          [counts.total_fetched, counts.total_imported, counts.total_skipped, counts.total_failed, jobId],
        );
      };

      const finalCounts = await executeWordPressImport({
        authorId: adminId,
        jobId,
        onProgress,
      });

      // Update job to completed
      await execute(
        `UPDATE wordpress_import_jobs
         SET status = 'completed', completed_at = NOW(),
             total_fetched = $1, total_imported = $2, total_skipped = $3, total_failed = $4
         WHERE id = $5`,
        [finalCounts.total_fetched, finalCounts.total_imported, finalCounts.total_skipped, finalCounts.total_failed, jobId],
      );

      // Log wordpress_import_completed
      await activityLog.log({
        actor_id: adminId,
        actor_type: 'admin',
        action: 'wordpress_import_completed',
        target_type: 'article',
        details: {
          jobId,
          total_fetched: finalCounts.total_fetched,
          total_imported: finalCounts.total_imported,
          total_skipped: finalCounts.total_skipped,
          total_failed: finalCounts.total_failed,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Update job to failed
      await execute(
        `UPDATE wordpress_import_jobs
         SET status = 'failed', completed_at = NOW(), error_message = $1
         WHERE id = $2`,
        [errorMessage, jobId],
      ).catch(() => {
        // If we can't even update the job record, there's nothing more we can do
      });

      // Log wordpress_import_failed
      await activityLog.log({
        actor_id: adminId,
        actor_type: 'admin',
        action: 'wordpress_import_failed',
        target_type: 'article',
        details: {
          jobId,
          error: errorMessage,
        },
      }).catch(() => {
        // Best-effort logging
      });
    }
  };

  // Fire-and-forget — intentionally not awaited
  importPromise().catch(() => {
    // Final safety net — errors should already be handled inside importPromise
  });
}
