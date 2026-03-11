import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/accounts
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    
    // Use the view to get balances computed from ledger
    const result = await query(`SELECT * FROM v_account_balances ORDER BY balance DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Accounts] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST /api/accounts
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { name, type, currency, description, institution, account_number, initial_balance } = body;
    if (!name || !type) return NextResponse.json({ success: false, error: 'name and type are required' }, { status: 400 });

    const VALID_TYPES = ['bank','cash','mobile_money','credit_card','investment','escrow','savings','internal','salary','other'];
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: `Invalid account type "${type}". Allowed: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO accounts (name, type, currency, description, institution, account_number)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, currency||'UGX', description||null, institution||null, account_number||null]
    );

    // If initial balance provided, create a ledger entry
    if (initial_balance && parseFloat(initial_balance) !== 0) {
      await query(
        `INSERT INTO ledger (account_id, amount, currency, source_type, description, category, entry_date, created_by)
         VALUES ($1,$2,$3,'initial_balance',$4,'initial_balance',CURRENT_DATE,$5)`,
        [result.rows[0].id, parseFloat(initial_balance), currency||'UGX',
         `Initial balance for ${name}`, auth.userId]
      );
    }

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'account', result.rows[0].id, JSON.stringify({ name, type })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Accounts] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create account' }, { status: 500 });
  }
}
