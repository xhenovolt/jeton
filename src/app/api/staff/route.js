import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';

// GET /api/staff
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'employees', 'view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    let sql = `SELECT s.*, m.name as manager_name, a.name as salary_account_name,
                      r.name as role_name, r.hierarchy_level, r.alias as role_alias,
                      d.name as dept_name,
                      CASE
                        WHEN up.last_ping > NOW() - INTERVAL '60 seconds' THEN 'online'
                        WHEN up.last_ping > NOW() - INTERVAL '5 minutes' THEN 'away'
                        ELSE 'offline'
                      END AS presence_status,
                      up.last_ping AS last_seen_at,
                      (SELECT COALESCE(json_agg(json_build_object(
                        'id', sr_r.id, 'name', sr_r.name,
                        'authority_level', sr_r.authority_level,
                        'department_name', COALESCE(sr_d.name, sr_d.department_name)
                      )), '[]'::json)
                       FROM staff_roles sr2
                       JOIN roles sr_r ON sr2.role_id = sr_r.id
                       LEFT JOIN departments sr_d ON sr_r.department_id = sr_d.id
                       WHERE sr2.staff_id = s.id) AS assigned_roles
               FROM staff s
               LEFT JOIN staff m ON s.manager_id = m.id
               LEFT JOIN accounts a ON s.salary_account_id = a.id
               LEFT JOIN roles r ON s.role_id = r.id
               LEFT JOIN departments d ON s.department_id = d.id
               LEFT JOIN users u ON s.user_id = u.id OR (s.email IS NOT NULL AND s.email = u.email)
               LEFT JOIN user_presence up ON u.id = up.user_id
               WHERE 1=1`;
    const params = [];
    if (department) { params.push(department); sql += ` AND (s.department = $${params.length} OR d.name = $${params.length})`; }
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
    const { name, role, role_id, status, joined_at, notes, email, phone, department, department_id, position, salary, salary_currency, salary_account_id, manager_id, hire_date, photo_url } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO staff (name, role, role_id, status, joined_at, notes, email, phone, department, department_id, position, salary, salary_currency, salary_account_id, manager_id, hire_date, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [name, role || null, role_id || null, status || 'active', joined_at || null, notes || null,
       email || null, phone || null, department || null, department_id || null, position || null,
       salary || null, salary_currency || 'UGX', salary_account_id || null,
       manager_id || null, hire_date || null, photo_url || null]
    );

    // Log the hire action
    await query(`INSERT INTO staff_actions (staff_id, action_type, new_role_id, new_role_name, new_authority_level, performed_by)
      VALUES ($1, 'hire', $2, $3, $4, $5)`,
      [result.rows[0].id, role_id || null, role || null, null, auth.userId]);

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'staff', result.rows[0].id, JSON.stringify({ name, department, position })]);

    dispatch('staff_created', {
      entityType: 'staff', entityId: result.rows[0].id,
      description: `Staff member "${name}" was added`, actorId: auth.userId,
      metadata: { name, department: department || null, position: position || null },
    });

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

    const allowed = ['name','role','role_id','status','joined_at','notes','email','phone','department','department_id','position','salary','salary_currency','salary_account_id','manager_id','hire_date','photo_url','is_active','account_status','user_id'];
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
