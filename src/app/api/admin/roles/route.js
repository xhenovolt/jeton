/**
 * Roles API
 * GET: List all roles
 * POST: Create custom role
 */

import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-utils';



async function checkPermission(userId, permissionName) {
  const superAdminCheck = await query(
    'SELECT is_superadmin FROM users WHERE id = $1',
    [userId]
  );

  if (superAdminCheck.rows[0]?.is_superadmin) return true;

  const permCheck = await query(
    `SELECT 1 FROM user_permissions up
     JOIN permissions p ON p.id = up.permission_id
     WHERE up.user_id = $1 AND p.name = $2
     AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
    [userId, permissionName]
  );

  return permCheck.rowCount > 0;
}

function checkAdminAccess(authData) {
  return authData.role === 'superadmin' || authData.role === 'admin';
}

export async function GET(request) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = checkAdminAccess(authData);
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const rolesResult = await query(
      `SELECT 
        r.id, r.name, r.description, r.is_system,
        r.created_at
       FROM roles r
       ORDER BY r.is_system DESC, r.name ASC`
    );

    return Response.json({
      success: true,
      data: rolesResult.rows,
    });
  } catch (error) {
    console.error('Roles GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only superadmin/admin can create roles
    const isAdmin = checkAdminAccess(authData);
    if (!isAdmin) {
      return Response.json(
        { success: false, error: 'Only superadmin can create roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, permission_ids = [] } = body;

    if (!name) {
      return Response.json(
        { success: false, error: 'Role name is required' },
        { status: 400 }
      );
    }

    const roleResult = await query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, is_system, created_at`,
      [name, description || null]
    );

    return Response.json(
      {
        success: true,
        message: 'Role created successfully',
        data: roleResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Roles POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
