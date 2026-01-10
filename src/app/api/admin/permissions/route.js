/**
 * Permissions API
 * GET: List all permissions
 */

import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-utils';



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

    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');

    let queryStr = `
      SELECT id, name, description, module, action
      FROM permissions
    `;

    const params = [];

    if (module) {
      params.push(module);
      queryStr += ` WHERE module = $${params.length}`;
    }

    queryStr += ` ORDER BY module, action`;

    const permissionsResult = await query(queryStr, params);

    // Group by module
    const grouped = {};
    permissionsResult.rows.forEach((perm) => {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    });

    return Response.json({
      success: true,
      data: permissionsResult.rows,
      grouped,
    });
  } catch (error) {
    console.error('Permissions GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
