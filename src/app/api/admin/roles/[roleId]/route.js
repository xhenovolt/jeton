/**
 * GET /api/admin/roles/[roleId] - Get role with permissions
 * PUT /api/admin/roles/[roleId] - Update role permissions
 * DELETE /api/admin/roles/[roleId] - Delete custom role
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
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
    const { description, permissionIds } = await request.json();

    // Update description if provided
    if (description !== undefined) {
      await query('UPDATE roles SET description = $1, updated_at = NOW() WHERE id = $2', [description, roleId]);
    }

    // Replace permissions if provided
    if (Array.isArray(permissionIds)) {
      await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      for (const permId of permissionIds) {
        await query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [roleId, permId]
        );
      }
    }

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
    const roleResult = await query('SELECT is_system FROM roles WHERE id = $1', [roleId]);
    if (!roleResult.rows[0]) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }
    if (roleResult.rows[0].is_system) {
      return NextResponse.json({ success: false, error: 'Cannot delete system roles' }, { status: 400 });
    }

    await query('DELETE FROM roles WHERE id = $1', [roleId]);
    return NextResponse.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete role' }, { status: 500 });
  }
}
