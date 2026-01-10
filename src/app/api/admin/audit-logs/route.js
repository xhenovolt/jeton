/**
 * Audit Logs API
 * GET: View audit logs with filters
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
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const userId = searchParams.get('user_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT 
        al.id, al.actor_id, u.email, al.action, 
        al.entity, al.entity_id, al.metadata, al.status, 
        al.ip_address, al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      WHERE 1=1
    `;

    const params = [];

    if (action) {
      params.push(action);
      queryStr += ` AND al.action = $${params.length}`;
    }

    if (entity) {
      params.push(entity);
      queryStr += ` AND al.entity = $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      queryStr += ` AND al.actor_id = $${params.length}`;
    }

    queryStr += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const logsResult = await query(queryStr, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (action) {
      countParams.push(action);
      countQuery += ` AND action = $${countParams.length}`;
    }

    if (entity) {
      countParams.push(entity);
      countQuery += ` AND entity = $${countParams.length}`;
    }

    if (userId) {
      countParams.push(userId);
      countQuery += ` AND actor_id = $${countParams.length}`;
    }

    const countResult = await query(countQuery, countParams);

    return Response.json({
      success: true,
      data: logsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    console.error('Audit logs GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
