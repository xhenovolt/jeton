/**
 * Server-side "full" user loader.
 *
 * Returns the same shape /api/auth/me returns — user + permissions +
 * hierarchy + pending approvals — so the app layout can hand it into
 * the PermissionProvider on the first render. Without this, the
 * provider had to spin on /api/auth/me from the client after
 * hydration, and the sidebar showed empty for the whole round trip
 * (up to 30s on Neon cold starts).
 *
 * Kept separate from getCurrentUser() because that helper is used in
 * hot paths that only need identity — the RBAC joins here are
 * expensive to run unconditionally.
 */

import { cookies } from 'next/headers.js';
import { getSession } from './session.js';
import { query } from './db.js';
import { getUserPermissions, getUserHierarchyLevel, getUserAuthorityLevel } from './permissions.js';

export async function getCurrentUserFull() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('jeton_session')?.value;
    if (!sessionId) return null;

    const session = await getSession(sessionId);
    if (!session) return null;

    const userResult = await query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.is_active,
              u.authority_level, u.first_login_completed, u.created_at
       FROM users u WHERE u.id = $1`,
      [session.userId]
    );
    if (userResult.rows.length === 0) return null;

    const user = userResult.rows[0];
    const isSuperadmin = user.role === 'superadmin';

    let rbacRoles = [];
    try {
      const rolesResult = await query(
        `SELECT r.name FROM users u
         JOIN staff s ON u.staff_id = s.id
         JOIN staff_roles sr ON sr.staff_id = s.id
         JOIN roles r ON sr.role_id = r.id
         WHERE u.id = $1`,
        [user.id]
      );
      rbacRoles = rolesResult.rows.map(r => r.name);
    } catch { /* RBAC tables may not exist */ }

    let permissions = [];
    let hierarchyLevel = 5;
    let authorityLevel = user.authority_level ?? 10;
    try {
      if (isSuperadmin) {
        permissions = ['*'];
        hierarchyLevel = 1;
        authorityLevel = 100;
      } else {
        [permissions, hierarchyLevel, authorityLevel] = await Promise.all([
          getUserPermissions(user.id),
          getUserHierarchyLevel(user.id),
          getUserAuthorityLevel(user.id),
        ]);
      }
    } catch { /* RBAC tables may not exist */ }

    let pendingApprovals = 0;
    try {
      if (hierarchyLevel <= 3) {
        const r = await query(`SELECT COUNT(*) AS cnt FROM approval_requests WHERE status = 'pending'`);
        pendingApprovals = parseInt(r.rows[0]?.cnt || 0, 10);
      }
    } catch { /* table may not exist */ }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      full_name: user.name,
      role: user.role,
      status: user.status,
      is_active: user.is_active,
      is_superadmin: isSuperadmin,
      roles: rbacRoles.length > 0 ? rbacRoles : [user.role],
      permissions,
      hierarchy_level: hierarchyLevel,
      authority_level: authorityLevel,
      first_login_completed: user.first_login_completed ?? true,
      pending_approvals: pendingApprovals,
      created_at: user.created_at,
    };
  } catch (err) {
    // Neon cold start or DB unavailable — return null and let the
    // client-side fetch loop retry. The layout will still redirect
    // unauthenticated visitors via the plain getCurrentUser() check.
    console.warn('[getCurrentUserFull] falling back:', err.message);
    return null;
  }
}
