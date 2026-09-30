/**
 * POST /api/auth/change-password
 *
 * Self-service password change for a signed-in user.
 * Body: { currentPassword, newPassword }
 *
 * - Verifies the current password (bcrypt)
 * - Applies the same strength rules as /api/auth/setup-password
 * - Revokes every OTHER session for the user, keeping the current one
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { hashPassword, comparePassword } from '@/lib/auth.js';
import { revokeAllUserSessionsExcept } from '@/lib/session.js';
import { query } from '@/lib/db.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';

function validateStrength(pw) {
  if (!pw || typeof pw !== 'string') return 'New password is required.';
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return null;
}

export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword) {
      return NextResponse.json({ success: false, error: 'Current password is required.' }, { status: 400 });
    }
    const weak = validateStrength(newPassword);
    if (weak) return NextResponse.json({ success: false, error: weak }, { status: 400 });
    if (newPassword === currentPassword) {
      return NextResponse.json({ success: false, error: 'New password must differ from the current one.' }, { status: 400 });
    }

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [auth.userId]);
    const hash = rows[0]?.password_hash;
    if (!hash || !(await comparePassword(currentPassword, hash))) {
      await logAuthEvent({
        action: 'PASSWORD_CHANGE_FAILURE',
        userId: auth.userId,
        email: auth.email,
        reason: 'Current password incorrect',
        requestMetadata: extractRequestMetadata(request),
      });
      return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 400 });
    }

    await query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [await hashPassword(newPassword), auth.userId]
    );

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get('jeton_session')?.value ?? null;
    try {
      await revokeAllUserSessionsExcept(auth.userId, currentSessionId);
    } catch (err) {
      console.warn('[change-password] revoking other sessions failed:', err.message);
    }

    await logAuthEvent({
      action: 'PASSWORD_CHANGE_SUCCESS',
      userId: auth.userId,
      email: auth.email,
      requestMetadata: extractRequestMetadata(request),
    });

    return NextResponse.json({ success: true, message: 'Password updated. Other devices have been signed out.' });
  } catch (error) {
    if (error?.name === 'DatabaseUnavailableError') {
      return NextResponse.json({ success: false, error: 'Database temporarily unavailable. Please retry.' }, { status: 503 });
    }
    console.error('[change-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to change password' }, { status: 500 });
  }
}
