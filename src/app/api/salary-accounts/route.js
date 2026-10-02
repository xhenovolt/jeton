import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/salary-accounts
 * Get all salary accounts (with optional filters)
 */
export async function GET(req) {
  // Compensation data. This route previously had NO authentication at all, so
  // every staff member's salary was readable by any anonymous caller.
  const perm = await requirePermission(req, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staff_id');
    
    // Named `sql`, not `query` — the local would otherwise shadow the imported
    // query() helper and the call below would throw "query is not a function".
    let sql = 'SELECT * FROM salary_accounts';
    const params = [];

    if (staffId) {
      sql += ' WHERE staff_id = $1';
      params.push(staffId);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching salary accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salary accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/salary-accounts
 * Create a new salary account
 */
export async function POST(req) {
  // Was unauthenticated: anyone could assign a salary to any staff member.
  const perm = await requirePermission(req, 'finance.manage');
  if (perm instanceof NextResponse) return perm;

  const { staff_id, account_id, salary_amount, frequency, currency } = await req.json();

  if (!staff_id || !account_id || !salary_amount) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }
  
  try {
    const result = await query(
      `INSERT INTO salary_accounts (staff_id, account_id, salary_amount, frequency, currency, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (staff_id) DO UPDATE
       SET account_id = $2, salary_amount = $3, frequency = $4, currency = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [staff_id, account_id, salary_amount, frequency || 'monthly', currency || 'UGX']
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating salary account:', error);
    return NextResponse.json(
      { error: 'Failed to create salary account: ' + error.message },
      { status: 500 }
    );
  }
}
