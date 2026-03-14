/**
 * GET /api/org/change-logs - Audit trail for all org structural changes
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const entityType = searchParams.get('entity_type');

    let where = '';
    const params = [limit];
    if (entityType) {
      where = 'WHERE ocl.entity_type = $2';
      params.push(entityType);
    }

    const result = await query(
      `SELECT ocl.*, u.name AS changed_by_name, u.email AS changed_by_email
       FROM org_change_logs ocl
       LEFT JOIN users u ON ocl.changed_by = u.id
       ${where}
       ORDER BY ocl.created_at DESC
       LIMIT $1`,
      params
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch org change logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch org change logs' }, { status: 500 });
  }
}
