/**
 * GET /api/auth/me
 * Get current user information from session with roles, permissions,
 * hierarchy level, and pending approval count
 */

import { NextResponse } from 'next/server.js';
import { cookies } from 'next/headers.js';
import { getSession } from '@/lib/session.js';
import { logRouteAccess, extractRequestMetadata } from '@/lib/audit.js';
import { query } from '@/lib/db.js';
import { getUserPermissions, getUserHierarchyLevel, getUserAuthorityLevel } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const requestMetadata = extractRequestMetadata(request);

    // Get session from cookies
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('jeton_session')?.value;

    if (!sessionId) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        reason: 'No session provided',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await getSession(sessionId);

    if (!session) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        reason: 'Invalid or expired session',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch detailed user information with RBAC roles
    const userResult = await query(
      `SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.status,
        u.is_active,
        u.authority_level,
        u.first_login_completed,
        u.created_at
      FROM users u
      WHERE u.id = $1`,
      [session.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];
    const isSuperadmin = user.role === 'superadmin';

    // Fetch RBAC roles for the user
    let rbacRoles = [];
    try {
      const rolesResult = await query(
        `SELECT r.name, r.hierarchy_level
         FROM users u
         JOIN staff s ON u.staff_id = s.id
         JOIN staff_roles sr ON sr.staff_id = s.id
         JOIN roles r ON sr.role_id = r.id
         WHERE u.id = $1`,
        [user.id]
      );
      rbacRoles = rolesResult.rows.map(r => r.name);
    } catch (_) { /* RBAC tables may not exist yet */ }

    // Fetch permissions.
    //
    // This catch used to swallow EVERY failure and leave permissions as [],
    // still answering HTTP 200. An empty array is indistinguishable from "this
    // user is permitted nothing", so a transient failure here presented as a
    // permissions decision: the client showed "Limited Access" and a reload
    // fixed it. A database outage must not be reported as an access level.
    let permissions = [];
    let hierarchyLevel = 5;
    let authorityLevel = user.authority_level ?? 10;
    let permissionsDegraded = false;
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
    } catch (error) {
      // A suspended or unreachable database is temporary. Surface it as 503 so
      // the client retries, rather than telling the user they have no access.
      if (error?.name === 'DatabaseUnavailableError' || error?.code === 'EDBDOWN') {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please retry.', code: 'DB_UNAVAILABLE' },
          { status: 503, headers: { 'Retry-After': '3' } }
        );
      }
      // Anything else (e.g. RBAC tables genuinely absent) degrades, but the
      // response now says so instead of implying an empty permission set is
      // the user's real access level.
      console.error('[auth/me] permission load failed:', error?.message);
      permissionsDegraded = true;
    }

    // Count pending approval requests for this user (if they have authority)
    let pendingApprovals = 0;
    try {
      if (hierarchyLevel <= 3) {
        const approvalResult = await query(
          `SELECT COUNT(*) AS cnt FROM approval_requests WHERE status = 'pending'`
        );
        pendingApprovals = parseInt(approvalResult.rows[0]?.cnt || 0, 10);
      }
    } catch (_) { /* approval_requests table may not exist yet */ }

    // Log successful access
    await logRouteAccess({
      action: 'PROTECTED_ROUTE_ACCESS',
      route: '/api/auth/me',
      userId: session.userId,
      requestMetadata,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          full_name: user.name,
          role: user.role,
          status: user.status,
          is_active: user.is_active,
          is_superadmin: isSuperadmin,
          roles: rbacRoles.length > 0 ? rbacRoles : [user.role],
          permissions: permissions,
          hierarchy_level: hierarchyLevel,
          authority_level: authorityLevel,
          first_login_completed: user.first_login_completed ?? true,
          pending_approvals: pendingApprovals,
          created_at: user.created_at,
          // True when the permission list could not be read. The client must
          // not present an empty list as a deliberate access level.
          permissions_degraded: permissionsDegraded,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Surface Neon cold-start / unreachable as 503 with Retry-After so the
    // client knows it's a backend availability problem, NOT an auth issue.
    // Previously this was buried as 401 + 33-second wait because session
    // lookup swallowed the timeout.
    if (error?.name === 'DatabaseUnavailableError') {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.', code: 'DB_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '3' } }
      );
    }
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
