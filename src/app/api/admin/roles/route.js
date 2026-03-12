/**
 * GET /api/admin/roles - List all roles with permission counts and hierarchy
 * POST /api/admin/roles - Create a new custom role with hierarchy level
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { logRbacEvent, extractRbacMetadata } from '@/lib/rbac-audit.js';
import { invalidateAllPermissionCaches } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const result = await query(`
      SELECT r.id, r.name, r.description, r.is_system, r.hierarchy_level, r.created_at,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
      FROM roles r
      ORDER BY r.hierarchy_level ASC, r.name ASC
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
    }

    const { name, description, permissionIds, hierarchy_level } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Role name is required' }, { status: 400 });
    }

    const sanitizedName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const level = Math.max(2, Math.min(10, parseInt(hierarchy_level) || 5));

    // Create role
    const roleResult = await query(
      'INSERT INTO roles (name, description, is_system, hierarchy_level) VALUES ($1, $2, false, $3) RETURNING id, name, description, hierarchy_level',
      [sanitizedName, description || '', level]
    );

    const role = roleResult.rows[0];

    // Assign permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds.map((permId, i) => `($1, $${i + 2})`).join(', ');
      const params = [role.id, ...permissionIds];
      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }

    // Audit log
    const meta = extractRbacMetadata(request);
    await logRbacEvent({
      userId: auth.userId,
      action: 'role_created',
      entityType: 'role',
      entityId: role.id,
      details: { roleName: role.name, hierarchyLevel: level, permissionCount: permissionIds?.length || 0 },
      ...meta,
    });

    invalidateAllPermissionCaches();

    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Role name already exists' }, { status: 409 });
    }
    console.error('Failed to create role:', error);
    return NextResponse.json({ success: false, error: 'Failed to create role' }, { status: 500 });
  }
}
