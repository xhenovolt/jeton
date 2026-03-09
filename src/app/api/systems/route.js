import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { Events } from '@/lib/events.js';

// GET /api/systems
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let sql = `
      SELECT s.*,
        (SELECT COUNT(*) FROM system_issues si WHERE si.system_id = s.id) as issue_count,
        (SELECT COUNT(*) FROM system_issues si WHERE si.system_id = s.id AND si.status = 'open') as open_issues,
        (SELECT COUNT(*) FROM system_changes sc WHERE sc.system_id = s.id) as change_count,
        (SELECT COUNT(*) FROM licenses l WHERE l.system_id = s.id AND l.status = 'active') as active_licenses,
        (SELECT COUNT(*) FROM deals d WHERE d.system_id = s.id) as deal_count,
        COALESCE((SELECT SUM(d.total_amount) FROM deals d WHERE d.system_id = s.id), 0) as total_revenue
      FROM systems s
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); sql += ` AND s.status = $${params.length}`; }
    sql += ` ORDER BY s.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Systems] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch systems' }, { status: 500 });
  }
}

// POST /api/systems
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { name, description, version, status } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO systems (name, description, version, status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, description || null, version || null, status || 'active']
    );

    await Events.systemCreated(result.rows[0].id, result.rows[0].name, auth.userId);
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Systems] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create system' }, { status: 500 });
  }
}
