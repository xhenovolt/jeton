/**
 * Admin User Detail API
 * GET: Get specific user with roles and permissions
 * PATCH: Update user
 * DELETE: Deactivate/delete user
 */

import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-utils';
import crypto from 'crypto';



async function checkPermission(userId, permissionName) {
  try {
    const superAdminCheck = await query(
      'SELECT is_superadmin FROM users WHERE id = $1',
      [userId]
    );

    if (superAdminCheck.rows[0]?.is_superadmin) {
      return true;
    }

    const userPermCheck = await query(
      `SELECT up.id FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1 AND p.name = $2
       AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
      [userId, permissionName]
    );

    if (userPermCheck.rowCount > 0) {
      return true;
    }

    const rolePermCheck = await query(
      `SELECT rp.id FROM role_permissions rp
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.name = $2`,
      [userId, permissionName]
    );

    return rolePermCheck.rowCount > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

export async function GET(request, { params }) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = await checkPermission(authData.userId, 'users.view');
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { userId } = params;

    // Get user with roles and permissions
    const userResult = await query(
      `SELECT 
        u.id, u.email, u.username, u.full_name, u.profile_photo_url,
        u.phone_number, u.department, u.status, u.is_superadmin,
        u.last_seen, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Get user roles
    const rolesResult = await query(
      `SELECT r.id, r.name, r.description
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );

    // Get user-specific permissions
    const permissionsResult = await query(
      `SELECT p.id, p.name, p.module, p.action, up.expires_at
       FROM permissions p
       JOIN user_permissions up ON up.permission_id = p.id
       WHERE up.user_id = $1
       AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
      [userId]
    );

    // Get sessions
    const sessionsResult = await query(
      `SELECT id, device_name, browser, os, ip_address, 
              country, city, last_activity, expires_at, is_active
       FROM sessions
       WHERE user_id = $1
       ORDER BY last_activity DESC`,
      [userId]
    );

    return Response.json({
      success: true,
      data: {
        ...user,
        roles: rolesResult.rows,
        permissions: permissionsResult.rows,
        sessions: sessionsResult.rows,
      },
    });
  } catch (error) {
    console.error('User GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = await checkPermission(authData.userId, 'users.update');
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { userId } = params;
    const body = await request.json();

    // Prevent demotion of superadmin
    if (body.is_superadmin === false) {
      const userCheck = await query(
        'SELECT is_superadmin FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows[0]?.is_superadmin) {
        return Response.json(
          { success: false, error: 'Cannot demote superadmin' },
          { status: 403 }
        );
      }
    }

    // Prevent deletion of xhenonpro@gmail.com
    if (body.status === 'deleted') {
      const emailCheck = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (emailCheck.rows[0]?.email === 'xhenonpro@gmail.com') {
        return Response.json(
          { success: false, error: 'Cannot delete superadmin user' },
          { status: 403 }
        );
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (body.full_name) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(body.full_name);
    }

    if (body.username) {
      updates.push(`username = $${paramCount++}`);
      values.push(body.username);
    }

    if (body.department) {
      updates.push(`department = $${paramCount++}`);
      values.push(body.department);
    }

    if (body.profile_photo_url) {
      updates.push(`profile_photo_url = $${paramCount++}`);
      values.push(body.profile_photo_url);
    }

    if (body.status) {
      updates.push(`status = $${paramCount++}`);
      values.push(body.status);
    }

    if (body.phone_number) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(body.phone_number);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by_id = $${paramCount++}`);
    values.push(authData.userId);

    values.push(userId);

    const updateResult = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, username, full_name, status, updated_at`,
      values
    );

    if (updateResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Update roles if provided
    if (body.role_ids) {
      // Remove old roles
      await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // Add new roles
      for (const roleId of body.role_ids) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by_id)
           VALUES ($1, $2, $3)`,
          [userId, roleId, authData.userId]
        );
      }
    }

    // Log audit
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, 
        changes, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        authData.userId,
        'USER_UPDATED',
        'users',
        userId,
        JSON.stringify(body),
        'SUCCESS',
      ]
    );

    return Response.json({
      success: true,
      message: 'User updated successfully',
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error('User PATCH error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = await checkPermission(authData.userId, 'users.delete');
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { userId } = params;

    // Prevent deletion of superadmin
    const userCheck = await query(
      'SELECT email, is_superadmin FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rowCount === 0) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userCheck.rows[0];

    if (user.email === 'xhenonpro@gmail.com' || user.is_superadmin) {
      return Response.json(
        { success: false, error: 'Cannot delete superadmin user' },
        { status: 403 }
      );
    }

    // Kill all active sessions
    await query(
      `UPDATE sessions
       SET is_active = false, killed_at = CURRENT_TIMESTAMP, killed_by_id = $1
       WHERE user_id = $2 AND is_active = true`,
      [authData.userId, userId]
    );

    // Set user as suspended
    const deleteResult = await query(
      `UPDATE users
       SET status = 'suspended', updated_at = CURRENT_TIMESTAMP, 
           updated_by_id = $1
       WHERE id = $2
       RETURNING id, email, username, status`,
      [authData.userId, userId]
    );

    // Log audit
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [authData.userId, 'USER_DELETED', 'users', userId, 'SUCCESS']
    );

    return Response.json({
      success: true,
      message: 'User deleted successfully',
      data: deleteResult.rows[0],
    });
  } catch (error) {
    console.error('User DELETE error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
