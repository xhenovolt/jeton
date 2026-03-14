/**
 * GET /api/admin/staff/[staffId]/roles - List roles assigned to a user
 * POST /api/admin/staff/[staffId]/roles - Assign roles to a user (with authority check)
 * DELETE /api/admin/staff/[staffId]/roles - Remove a role from a user
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { invalidatePermissionCache } from '@/lib/permissions.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { dispatch } from '@/lib/system-events.js';

export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { staffId } = await params;

    const result = await query(
      `SELECT r.id, r.name, r.description, r.hierarchy_level, r.authority_level, r.is_system, ur.assigned_by, ur.created_at AS assigned_at
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.authority_level DESC`,
      [staffId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch staff roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch staff roles' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { staffId } = await params;
    const body = await request.json();
    const roleIds = body.role_ids || body.roleIds;

    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return NextResponse.json({ success: false, error: 'role_ids array is required' }, { status: 400 });
    }

    // Get the assigner's authority level
    const assignerAuth = await query(
      `SELECT MAX(r.authority_level) AS max_authority
       FROM user_roles ur JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [auth.userId]
    );
    const assignerAuthority = assignerAuth.rows[0]?.max_authority || 0;

    // Check target roles' authority levels — can't assign roles with authority >= own (unless superadmin)
    if (auth.role !== 'superadmin') {
      const targetRoles = await query(
        `SELECT id, name, authority_level FROM roles WHERE id = ANY($1)`,
        [roleIds]
      );
      for (const role of targetRoles.rows) {
        if (role.authority_level >= assignerAuthority) {
          return NextResponse.json({
            success: false,
            error: `Cannot assign role "${role.name}" (authority ${role.authority_level}) — exceeds your authority level (${assignerAuthority})`,
          }, { status: 403 });
        }
      }
    }

    // Assign roles
    let assigned = 0;
    for (const roleId of roleIds) {
      const result = await query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [staffId, roleId, auth.userId]
      );
      assigned += result.rowCount;
    }

    invalidatePermissionCache(staffId);

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'staff_roles_assigned',
      entityType: 'user',
      entityId: staffId,
      details: { roleIds, assigned },
      ...meta,
    });

    dispatch('role_assigned', {
      entityType: 'user', entityId: staffId,
      description: `${assigned} role(s) assigned to staff member`,
      metadata: { roleIds, assignedBy: auth.userId },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: `${assigned} role(s) assigned`, assigned });
  } catch (error) {
    console.error('Failed to assign staff roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign staff roles' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { staffId } = await params;
    const { role_id } = await request.json();

    if (!role_id) {
      return NextResponse.json({ success: false, error: 'role_id is required' }, { status: 400 });
    }

    await query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [staffId, role_id]);

    invalidatePermissionCache(staffId);

    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'staff_role_removed',
      entityType: 'user',
      entityId: staffId,
      details: { roleId: role_id },
      ...meta,
    });

    dispatch('role_removed', {
      entityType: 'user', entityId: staffId,
      description: `Role removed from staff member`,
      metadata: { roleId: role_id, removedBy: auth.userId },
      actorId: auth.userId,
    });

    return NextResponse.json({ success: true, message: 'Role removed from staff' });
  } catch (error) {
    console.error('Failed to remove staff role:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove staff role' }, { status: 500 });
  }
}
