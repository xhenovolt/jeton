/**
 * GET /api/admin/roles - List all roles with permission counts
 * POST /api/admin/roles - Create a new custom role
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
    }

    const result = await query(`
      SELECT r.id, r.name, r.description, r.is_system, r.created_at,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
      FROM roles r
      ORDER BY r.is_system DESC, r.name ASC
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

    const { name, description, permissionIds } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Role name is required' }, { status: 400 });
    }

    // Create role
    const roleResult = await query(
      'INSERT INTO roles (name, description, is_system) VALUES ($1, $2, false) RETURNING id, name, description',
      [name.toLowerCase().trim(), description || '']
    );

    const role = roleResult.rows[0];

    // Assign permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [role.id, permId]
        );
      }
    }

    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Role name already exists' }, { status: 409 });
    }
    console.error('Failed to create role:', error);
    return NextResponse.json({ success: false, error: 'Failed to create role' }, { status: 500 });
  }
}
