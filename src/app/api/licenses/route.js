import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/licenses
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const system_id = searchParams.get('system_id');
    const status = searchParams.get('status');

    let sql = `
      SELECT l.*, s.name as system_name, d.total_amount as deal_value, d.currency as deal_currency
      FROM licenses l
      LEFT JOIN systems s ON l.system_id = s.id
      LEFT JOIN deals d ON l.deal_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND l.system_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND l.status = $${params.length}`; }
    sql += ` ORDER BY l.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Licenses] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch licenses' }, { status: 500 });
  }
}

// POST /api/licenses
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { system_id, deal_id, client_name, license_type, start_date, end_date, status, notes } = body;

    if (!client_name) return NextResponse.json({ success: false, error: 'client_name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO licenses (system_id, deal_id, client_name, license_type, start_date, end_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [system_id || null, deal_id || null, client_name, license_type || 'lifetime',
       start_date || null, end_date || null, status || 'active', notes || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Licenses] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create license' }, { status: 500 });
  }
}

// PATCH /api/licenses — update status
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, status, notes } = body;

    const result = await query(
      `UPDATE licenses SET status=$1, notes=$2 WHERE id=$3 RETURNING *`,
      [status, notes, id]
    );
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Licenses] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update license' }, { status: 500 });
  }
}
