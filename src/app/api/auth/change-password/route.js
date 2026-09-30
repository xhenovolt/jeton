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

import { cookies } from 'next/headers.js';
import { z } from 'zod';
import { withRoute, ok, fail } from '@/lib/api/route.js';
import { hashPassword, comparePassword } from '@/lib/auth.js';
import { revokeAllUserSessionsExcept } from '@/lib/session.js';
import { query } from '@/lib/db.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';

const Body = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
}).refine(b => b.newPassword !== b.currentPassword, {
  message: 'New password must differ from the current one.',
  path: ['newPassword'],
});

export const POST = withRoute({ signedIn: true, body: Body }, async ({ request, auth, body }) => {
  const requestMetadata = extractRequestMetadata(request);
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [auth.userId]);
  const hash = rows[0]?.password_hash;
  if (!hash || !(await comparePassword(body.currentPassword, hash))) {
    await logAuthEvent({
      action: 'PASSWORD_CHANGE_FAILURE',
      userId: auth.userId,
      email: auth.email,
      reason: 'Current password incorrect',
      requestMetadata,
    });
    return fail(400, 'Current password is incorrect.');
  }

  await query(
    `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [await hashPassword(body.newPassword), auth.userId]
  );

  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get('jeton_session')?.value ?? null;
  await revokeAllUserSessionsExcept(auth.userId, currentSessionId);

  await logAuthEvent({
    action: 'PASSWORD_CHANGE_SUCCESS',
    userId: auth.userId,
    email: auth.email,
    requestMetadata,
  });

  return ok({ message: 'Password updated. Other devices have been signed out.' });
});
