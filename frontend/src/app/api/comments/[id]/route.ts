import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { queryOne, execute } from '@shared/db';

interface CommentRow {
  id: string;
  article_id: string;
  display_name: string;
  content: string;
  status: string;
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
 * PUT /api/comments/[id]
 *
 * Update comment status (visible ↔ hidden). Admin only.
 *
 * Body: { status: 'visible' | 'hidden' }
 *
 * Requirements: 26.8
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await validateSession();
    if (!admin) {
      return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
    }

    const { id } = await params;

    const body = await request.json();
    const { status } = body;

    if (!status || !['visible', 'hidden'].includes(status)) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Status harus "visible" atau "hidden"',
        422,
      );
    }

    // Verify comment exists
    const comment = await queryOne<CommentRow>(
      `SELECT id, article_id, display_name, content, status FROM comments WHERE id = $1`,
      [id],
    );

    if (!comment) {
      return errorResponse('RESOURCE_NOT_FOUND', 'Komentar tidak ditemukan', 404);
    }

    // Update status
    await execute(
      `UPDATE comments SET status = $1 WHERE id = $2`,
      [status, id],
    );

    return NextResponse.json({
      success: true,
      data: { id, status },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal memperbarui komentar', 500);
  }
}

/**
 * DELETE /api/comments/[id]
 *
 * Permanently delete a comment. Admin only.
 *
 * Requirements: 26.8
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await validateSession();
    if (!admin) {
      return errorResponse('AUTH_REQUIRED', 'Autentikasi diperlukan', 401);
    }

    const { id } = await params;

    // Verify comment exists
    const comment = await queryOne<CommentRow>(
      `SELECT id FROM comments WHERE id = $1`,
      [id],
    );

    if (!comment) {
      return errorResponse('RESOURCE_NOT_FOUND', 'Komentar tidak ditemukan', 404);
    }

    // Delete comment
    await execute(`DELETE FROM comments WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Gagal menghapus komentar', 500);
  }
}
