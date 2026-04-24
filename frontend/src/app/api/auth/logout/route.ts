// ============================================
// Horizon Trader Platform — Admin Logout API
// ============================================

import { NextResponse } from 'next/server';
import {
  getSessionToken,
  deleteSession,
  clearSessionCookie,
} from '@/lib/auth';

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
 * POST /api/auth/logout
 *
 * End the current admin session.
 *
 * Flow:
 * 1. Read session token from cookie
 * 2. Delete session record from admin_sessions
 * 3. Clear the session cookie
 */
export async function POST() {
  try {
    const token = await getSessionToken();

    if (token) {
      await deleteSession(token);
    }

    await clearSessionCookie();

    return NextResponse.json({
      success: true,
      data: { message: 'Berhasil logout' },
    });
  } catch {
    // Even on error, try to clear the cookie
    try {
      await clearSessionCookie();
    } catch {
      // Ignore cookie clearing errors
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'Terjadi kesalahan pada server',
      500,
    );
  }
}
