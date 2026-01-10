/**
 * User Sessions API
 * GET: List sessions for a user
 * DELETE: Kill a session
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

    const sessionsResult = await query(
      `SELECT 
        id, device_name, browser, os, ip_address, country, city,
        last_activity, expires_at, is_active, created_at
       FROM sessions
       WHERE user_id = $1
       ORDER BY last_activity DESC`,
      [userId]
    );

    return Response.json({
      success: true,
      data: sessionsResult.rows,
    });
  } catch (error) {
    console.error('Sessions GET error:', error);
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

    const hasPermission = await checkPermission(authData.userId, 'users.update');
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { userId, sessionId } = params;

    const killResult = await query(
      `UPDATE sessions
       SET is_active = false, killed_at = CURRENT_TIMESTAMP, killed_by_id = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, is_active`,
      [authData.userId, sessionId, userId]
    );

    if (killResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: 'Session terminated',
      data: killResult.rows[0],
    });
  } catch (error) {
    console.error('Session DELETE error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
