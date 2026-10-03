import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * /api/employees — the HR view of the canonical employee domain.
 *
 * WHY THIS READS `staff`
 *
 * Jeton had two tables for one domain: `staff`, used by /app/staff, and
 * `employees`, used by /app/hrm. `staff` holds every real person (and their
 * user links, roles, departments, salary, termination lifecycle, and the
 * payouts / employee_accounts foreign keys); `employees` was empty. So /hrm
 * showed nothing while /staff showed the whole team.
 *
 * Rather than copy people into a second table — which would create two
 * records per person that immediately drift — this route now reads and writes
 * `staff`. `staff` is canonical; HR is a view onto it. A person created in
 * either screen is visible in both, because there is only one row.
 *
 * NAME FIELDS
 *
 * The HRM page renders first_name / last_name / status / position, while
 * `employees` exposed full_name / employment_status. Even with rows present,
 * HRM would have shown blank names. The projection below emits both spellings
 * from the single `staff.name`, so the page works without having to guess
 * which half of a name belongs where.
 *
 * `employees` is left in place untouched: performance_metrics.employee_id
 * still references it, and dropping a table is not something to do quietly.
 * It is now unused by this route and should be retired deliberately.
 */

/**
 * One projection, used by every handler here, so the shape can never drift
 * between list and write responses.
 */
const EMPLOYEE_SELECT = `
  SELECT
    s.id,
    s.name                                          AS full_name,
    -- The HRM page wants the name split; staff stores it whole.
    SPLIT_PART(TRIM(s.name), ' ', 1)                AS first_name,
    NULLIF(TRIM(SUBSTR(TRIM(s.name), STRPOS(TRIM(s.name), ' ') + 1)), '') AS last_name,
    s.email,
    s.phone,
    s.position,
    s.role_id,
    s.role,
    s.department_id,
    COALESCE(d.name, d.department_name, s.department) AS department_name,
    s.status,
    s.status                                        AS employment_status,
    s.employment_type,
    s.is_active,
    s.salary,
    s.salary_currency,
    COALESCE(s.hire_date, s.join_date, s.joined_at::date) AS hired_date,
    s.manager_id,
    m.name                                          AS manager_name,
    s.user_id                                       AS user_account_id,
    s.photo_url,
    s.notes,
    s.deactivated_at,
    s.deactivation_reason,
    s.created_at,
    s.updated_at
  FROM staff s
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN staff m       ON m.id = s.manager_id
`;

// GET /api/employees
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'employees', 'view');
    if (perm instanceof NextResponse) return perm;

    const { searchParams } = new URL(request.url);
    const department_id = searchParams.get('department_id');
    const status = searchParams.get('status');

    const where = [];
    const params = [];
    if (department_id) { params.push(department_id); where.push(`s.department_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`LOWER(s.status) = LOWER($${params.length})`); }

    const sql = `${EMPLOYEE_SELECT}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY s.name`;

    const result = await query(sql, params);

    // Headcount and payroll over the same canonical table, so the stat cards
    // can never disagree with the list beneath them.
    const stats = await query(`
      SELECT COUNT(*)::int AS total_active,
             COALESCE(SUM(salary), 0) AS total_salary
        FROM staff
       WHERE is_active = TRUE AND LOWER(COALESCE(status,'')) NOT IN ('terminated','inactive','archived')
    `);

    return NextResponse.json({ success: true, data: result.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error('[Employees] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST /api/employees — creates a staff row, so the person appears in both screens
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'staff.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    // Accept either a whole name or the split form the HRM form submits.
    const fullName = (body.full_name
      || [body.first_name, body.last_name].filter(Boolean).join(' ')).trim();

    if (!fullName) {
      return NextResponse.json(
        { success: false, error: 'full_name (or first_name / last_name) is required' }, { status: 400 });
    }

    const inserted = await query(
      `INSERT INTO staff
         (name, email, phone, position, role_id, department_id,
          status, employment_type, salary, salary_currency,
          hire_date, manager_id, user_id, notes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)
       RETURNING id`,
      [
        fullName, body.email || null, body.phone || null, body.position || null,
        body.role_id || null, body.department_id || null,
        body.employment_status || body.status || 'active',
        body.employment_type || 'full_time',
        body.salary || null, body.salary_currency || 'UGX',
        body.hired_date || null, body.manager_id || null,
        body.user_account_id || null, body.notes || null,
      ]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'CREATE','staff',$2,$3)`,
      [auth.userId, inserted.rows[0].id, JSON.stringify({ name: fullName, via: 'hrm' })]
    ).catch(() => {});

    const row = await query(`${EMPLOYEE_SELECT} WHERE s.id = $1`, [inserted.rows[0].id]);
    return NextResponse.json({ success: true, data: row.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Employees] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create employee' }, { status: 500 });
  }
}

// PUT /api/employees — updates the same staff row /app/staff edits
export async function PUT(request) {
  try {
    // This previously accepted any authenticated user. Editing employment
    // records is a staff.update action.
    const perm = await requirePermission(request, 'staff.update');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    // Map the HR vocabulary onto the canonical staff columns.
    const COLUMN_FOR = {
      full_name: 'name',
      email: 'email',
      phone: 'phone',
      position: 'position',
      role_id: 'role_id',
      department_id: 'department_id',
      employment_status: 'status',
      status: 'status',
      employment_type: 'employment_type',
      salary: 'salary',
      salary_currency: 'salary_currency',
      hired_date: 'hire_date',
      manager_id: 'manager_id',
      notes: 'notes',
      photo_url: 'photo_url',
    };

    const sets = [];
    const values = [];
    for (const [incoming, column] of Object.entries(COLUMN_FOR)) {
      if (body[incoming] === undefined) continue;
      values.push(body[incoming] === '' ? null : body[incoming]);
      sets.push(`${column} = $${values.length}`);
    }
    // Allow a name supplied only in split form.
    if (body.full_name === undefined && (body.first_name || body.last_name)) {
      values.push([body.first_name, body.last_name].filter(Boolean).join(' ').trim());
      sets.push(`name = $${values.length}`);
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }
    sets.push('updated_at = NOW()');
    values.push(id);

    const updated = await query(
      `UPDATE staff SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`, values);
    if (!updated.rows[0]) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'UPDATE','staff',$2,$3)`,
      [auth.userId, id, JSON.stringify({ ...body, via: 'hrm' })]
    ).catch(() => {});

    const row = await query(`${EMPLOYEE_SELECT} WHERE s.id = $1`, [id]);
    return NextResponse.json({ success: true, data: row.rows[0] });
  } catch (error) {
    console.error('[Employees] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update employee' }, { status: 500 });
  }
}
