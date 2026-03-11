import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

const VALID_CATEGORIES = ['business_tool', 'infrastructure', 'hardware'];

// GET /api/resources
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    let sql = `SELECT r.*, s.name as assigned_to_name FROM resources r LEFT JOIN staff s ON r.assigned_to = s.id WHERE 1=1`;
    const params = [];
    if (category) { params.push(category); sql += ` AND r.category = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND r.status = $${params.length}`; }
    sql += ` ORDER BY r.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Resources] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch resources' }, { status: 500 });
  }
}

// POST /api/resources
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { name, category, description, cost, currency, usage_notes, provider, renewal_date, serial_number, assigned_to, acquisition_date, status, notes } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO resources (name, category, description, cost, currency, usage_notes, provider, renewal_date, serial_number, assigned_to, acquisition_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, category, description || null, cost || 0, currency || 'UGX', usage_notes || null, provider || null,
       renewal_date || null, serial_number || null, assigned_to || null, acquisition_date || null,
       status || 'active', notes || null, auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'resource', result.rows[0].id, JSON.stringify({ name, category })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Resources] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create resource' }, { status: 500 });
  }
}

// PATCH /api/resources
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const allowed = ['name','category','description','cost','currency','usage_notes','provider','renewal_date','serial_number','assigned_to','acquisition_date','status','notes'];
    const updates = [];
    const values = [];
    allowed.forEach(f => {
      if (fields[f] !== undefined) { values.push(fields[f]); updates.push(`${f} = $${values.length}`); }
    });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await query(`UPDATE resources SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Resource not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Resources] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update resource' }, { status: 500 });
  }
}

// DELETE /api/resources?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    const result = await query(`DELETE FROM resources WHERE id=$1 RETURNING id`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete resource' }, { status: 500 });
  }
}
