/**
 * GET /api/admin/user-permissions/[userId]
 * Returns the full permission set for any user. Superadmin / roles.manage only.
 *
 * Response:
 *   { success: true, data: { user, roles, permissions, byModule } }
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getUserPermissions } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'roles.manage');
  if (perm instanceof NextResponse) return perm;

  const { userId } = await params;

  try {
    // User info
    const userResult = await query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.is_active, u.created_at,
              s.first_name, s.last_name, s.position
       FROM users u
       LEFT JOIN staff s ON u.staff_id = s.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];
    const isSuperadmin = user.role === 'superadmin';

    // Assigned roles (via staff_roles chain)
    const rolesResult = await query(
      `SELECT r.id, r.name, r.description, r.hierarchy_level, r.authority_level
       FROM users u
       JOIN staff s ON u.staff_id = s.id
       JOIN staff_roles sr ON sr.staff_id = s.id
       JOIN roles r ON sr.role_id = r.id
       WHERE u.id = $1
       ORDER BY r.hierarchy_level ASC`,
      [userId]
    );
    const roles = rolesResult.rows;

    // Effective permissions
    let permissions = [];
    if (isSuperadmin) {
      permissions = ['*'];
    } else {
      permissions = await getUserPermissions(userId);
    }

    // Group permissions by module
    const byModule = {};
    if (permissions[0] === '*') {
      byModule['*'] = ['All permissions (superadmin)'];
    } else {
      for (const p of permissions) {
        const [mod, action] = p.split('.');
        if (!byModule[mod]) byModule[mod] = [];
        byModule[mod].push(action);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email,
          role: user.role,
          status: user.status,
          is_active: user.is_active,
          is_superadmin: isSuperadmin,
          position: user.position,
        },
        roles,
        permissions,
        byModule,
      },
    });
  } catch (error) {
    console.error('Permission inspect error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user permissions' }, { status: 500 });
  }
}
