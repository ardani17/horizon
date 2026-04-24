// ============================================
// Horizon Trader Platform — Admin Login API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { queryOne } from '@shared/db';
import { ActivityLogService } from '@shared/services/activityLog';
import type { User } from '@shared/types';
import { createSession, setSessionCookie } from '@/lib/auth';

const activityLog = new ActivityLogService();

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
 * POST /api/auth/login
 *
 * Authenticate an admin user with username and password.
 *
 * Flow:
 * 1. Validate request body (username, password)
 * 2. Look up user by username
 * 3. Compare password with bcrypt hash
 * 4. Verify user has admin role
 * 5. Create session token, store hash in admin_sessions
 * 6. Set HttpOnly + Secure + SameSite=Strict cookie
 * 7. Log failed attempts to activity_logs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (
      typeof username !== 'string' || !username.trim() ||
      typeof password !== 'string' || !password
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Username dan password diperlukan',
        422,
      );
    }

    const trimmedUsername = username.trim();

    // Extract IP address for logging
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null;

    // Look up user by username
    const user = await queryOne<User>(
      `SELECT id, telegram_id, username, password_hash, role, credit_balance, created_at
       FROM users
       WHERE username = $1`,
      [trimmedUsername],
    );

    // User not found or no password hash set
    if (!user || !user.password_hash) {
      await activityLog.log({
        actor_id: null,
        actor_type: 'system',
        action: 'admin_login_failed',
        target_type: 'user',
        target_id: null,
        details: {
          username: trimmedUsername,
          reason: 'user_not_found',
        },
        ip_address: ip,
      });

      return errorResponse(
        'AUTH_INVALID',
        'Username atau password salah',
        401,
      );
    }

    // Verify password with bcrypt
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      await activityLog.log({
        actor_id: user.id,
        actor_type: 'admin',
        action: 'admin_login_failed',
        target_type: 'user',
        target_id: user.id,
        details: {
          username: trimmedUsername,
          reason: 'invalid_password',
        },
        ip_address: ip,
      });

      return errorResponse(
        'AUTH_INVALID',
        'Username atau password salah',
        401,
      );
    }

    // Verify admin role
    if (user.role !== 'admin') {
      await activityLog.log({
        actor_id: user.id,
        actor_type: 'member',
        action: 'admin_login_failed',
        target_type: 'user',
        target_id: user.id,
        details: {
          username: trimmedUsername,
          reason: 'not_admin',
        },
        ip_address: ip,
      });

      return errorResponse(
        'AUTH_FORBIDDEN',
        'Akses ditolak. Hanya admin yang dapat login.',
        403,
      );
    }

    // Create session and set cookie
    const token = await createSession(user.id);
    await setSessionCookie(token);

    // Log successful login
    await activityLog.log({
      actor_id: user.id,
      actor_type: 'admin',
      action: 'admin_login_success',
      target_type: 'user',
      target_id: user.id,
      details: { username: trimmedUsername },
      ip_address: ip,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch {
    return errorResponse(
      'INTERNAL_ERROR',
      'Terjadi kesalahan pada server',
      500,
    );
  }
}
