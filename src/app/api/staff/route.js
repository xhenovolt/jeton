import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/staff
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'employees', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    let sql = `SELECT s.*, m.name as manager_name, a.name as salary_account_name
               FROM staff s
               LEFT JOIN staff m ON s.manager_id = m.id
               LEFT JOIN accounts a ON s.salary_account_id = a.id
               WHERE 1=1`;
    const params = [];
    if (department) { params.push(department); sql += ` AND s.department = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND s.status = $${params.length}`; }
    sql += ` ORDER BY s.joined_at DESC NULLS LAST, s.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Staff] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST /api/staff
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { name, role, status, joined_at, notes, email, phone, department, position, salary, salary_currency, salary_account_id, manager_id, hire_date, photo_url } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO staff (name, role, status, joined_at, notes, email, phone, department, position, salary, salary_currency, salary_account_id, manager_id, hire_date, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [name, role || null, status || 'active', joined_at || null, notes || null,
       email || null, phone || null, department || null, position || null,
       salary || null, salary_currency || 'UGX', salary_account_id || null,
       manager_id || null, hire_date || null, photo_url || null]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'staff', result.rows[0].id, JSON.stringify({ name, department, position })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Staff] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create staff member' }, { status: 500 });
  }
}

// PATCH /api/staff — update any fields
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const allowed = ['name','role','status','joined_at','notes','email','phone','department','position','salary','salary_currency','salary_account_id','manager_id','hire_date','photo_url'];
    const updates = [];
    const values = [];
    allowed.forEach(f => {
      if (fields[f] !== undefined) { values.push(fields[f]); updates.push(`${f} = $${values.length}`); }
    });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await query(`UPDATE staff SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'staff', id, JSON.stringify(fields)]);

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Staff] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update staff member' }, { status: 500 });
  }
}

// DELETE /api/staff?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const reports = await query(`SELECT COUNT(*) FROM staff WHERE manager_id = $1`, [id]);
    if (parseInt(reports.rows[0].count) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete: other staff members report to this person' }, { status: 409 });
    }

    await query(`DELETE FROM staff WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete staff member' }, { status: 500 });
  }
}
