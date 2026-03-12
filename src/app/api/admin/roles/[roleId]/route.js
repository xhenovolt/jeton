/**
 * GET /api/admin/roles/[roleId] - Get role with permissions and hierarchy
 * PUT /api/admin/roles/[roleId] - Update role permissions and hierarchy
 * DELETE /api/admin/roles/[roleId] - Delete custom role
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { invalidateAllPermissionCaches } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { roleId } = await params;

    const roleResult = await query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (!roleResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    // Get assigned permissions
    const permsResult = await query(
      `SELECT p.id, p.module, p.action, p.description
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`,
      [roleId]
    );

    return NextResponse.json({
      success: true,
      data: { ...roleResult.rows[0], permissions: permsResult.rows },
    });
  } catch (error) {
    console.error('Failed to fetch role:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch role' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
    }

    const { roleId } = await params;
    const { description, permissionIds, hierarchy_level } = await request.json();

    const updates = [];
    const values = [];
    let idx = 1;

    if (description !== undefined) {
      updates.push(`description = $${idx}`);
      values.push(description);
      idx++;
    }

    if (hierarchy_level !== undefined) {
      const level = Math.max(2, Math.min(10, parseInt(hierarchy_level) || 5));
      updates.push(`hierarchy_level = $${idx}`);
      values.push(level);
      idx++;
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(roleId);
      await query(`UPDATE roles SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    // Replace permissions if provided
    if (Array.isArray(permissionIds)) {
      await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      if (permissionIds.length > 0) {
        const permValues = permissionIds.map((permId, i) => `($1, $${i + 2})`).join(', ');
        const permParams = [roleId, ...permissionIds];
        await query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${permValues} ON CONFLICT DO NOTHING`,
          permParams
        );
      }
    }

    // Audit log
    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_permissions_updated',
      entityType: 'role',
      entityId: roleId,
      details: { permissionCount: permissionIds?.length, hierarchyLevel: hierarchy_level },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, message: 'Role updated' });
  } catch (error) {
    console.error('Failed to update role:', error);
    return NextResponse.json({ success: false, error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
    }

    const { roleId } = await params;

    // Prevent deleting system roles
    const roleResult = await query('SELECT name, is_system FROM roles WHERE id = $1', [roleId]);
    if (!roleResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }
    if (roleResult.rows[0].is_system) {
      return NextResponse.json({ success: false, error: 'Cannot delete system roles' }, { status: 400 });
    }

    // Check if role has assigned users
    const usersResult = await query('SELECT COUNT(*) AS cnt FROM user_roles WHERE role_id = $1', [roleId]);
    if (parseInt(usersResult.rows[0].cnt) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete role with assigned users. Remove user assignments first.' }, { status: 400 });
    }

    await query('DELETE FROM roles WHERE id = $1', [roleId]);

    // Audit log
    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_deleted',
      entityType: 'role',
      entityId: roleId,
      details: { roleName: roleResult.rows[0].name },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete role' }, { status: 500 });
  }
}
