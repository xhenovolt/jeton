import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/activity — get recent activity logs
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '100');

    let sql = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) { params.push(user_id); sql += ` AND al.user_id = $${params.length}`; }
    if (action) { params.push(action); sql += ` AND al.action = $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Activity] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}

// POST /api/activity — log an activity event (page view, action, etc.)
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { action, entity_type, entity_id, route, page_title, details } = body;

    const result = await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, route, page_title, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        auth.userId,
        action || 'page_view',
        entity_type || null,
        entity_id || null,
        route || null,
        page_title || null,
        details ? JSON.stringify(details) : '{}',
      ]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('[Activity] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log activity' }, { status: 500 });
  }
}
