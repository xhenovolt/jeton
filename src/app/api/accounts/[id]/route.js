import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(`SELECT * FROM v_account_balances WHERE account_id = $1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    
    // Also get recent transactions
    const transactions = await query(
      `SELECT * FROM ledger WHERE account_id = $1 ORDER BY entry_date DESC, created_at DESC LIMIT 50`, [id]
    );
    
    return NextResponse.json({ success: true, data: { ...result.rows[0], transactions: transactions.rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch account' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'finance.create');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['name','type','currency','description','institution','account_number','is_active'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    values.push(id);
    const result = await query(`UPDATE accounts SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 });
  }
}
