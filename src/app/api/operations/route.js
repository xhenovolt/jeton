import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

const VALID_TYPES = [
  'coding', 'debugging', 'testing', 'deployment',
  'sales_meeting', 'prospecting', 'follow_up',
  'payment_collection', 'financial_allocation', 'other',
];

// GET /api/operations
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const system_id = searchParams.get('system_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    let sql = `
      SELECT o.*,
        s.name as system_name,
        d.title as deal_title
      FROM operations o
      LEFT JOIN systems s ON o.related_system_id = s.id
      LEFT JOIN deals d ON o.related_deal_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (type) { params.push(type); sql += ` AND o.operation_type = $${params.length}`; }
    if (system_id) { params.push(system_id); sql += ` AND o.related_system_id = $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Operations] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch operations' }, { status: 500 });
  }
}

// POST /api/operations
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { operation_type, description, related_system_id, related_deal_id, notes } = body;

    if (!operation_type || !VALID_TYPES.includes(operation_type)) {
      return NextResponse.json({ success: false, error: `operation_type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO operations (operation_type, description, related_system_id, related_deal_id, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [operation_type, description, related_system_id || null, related_deal_id || null, notes || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Operations] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log operation' }, { status: 500 });
  }
}
