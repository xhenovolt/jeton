import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/ledger — finance.view
export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { searchParams } = new URL(request.url);
    const account_id = searchParams.get('account_id');
    const source_type = searchParams.get('source_type');
    const category = searchParams.get('category');
    // The ledger UI sends start_date/end_date; earlier versions of this route
    // only read from_date/to_date, so every date filter was silently dropped.
    // Accept both rather than breaking whichever caller uses the other.
    const from_date = searchParams.get('from_date') || searchParams.get('start_date');
    const to_date = searchParams.get('to_date') || searchParams.get('end_date');
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // ── One WHERE clause, shared by the rows, the count and the totals ──────
    // The summary used to come from the unfiltered v_financial_summary view,
    // so it ignored every filter the user applied. Deriving all three from the
    // same predicate is what makes the cards agree with the rows beneath them.
    const where = [];
    const params = [];
    if (account_id)  { params.push(account_id);  where.push(`l.account_id = $${params.length}`); }
    if (source_type) { params.push(source_type); where.push(`l.source_type = $${params.length}`); }
    if (category)    { params.push(category);    where.push(`l.category = $${params.length}`); }
    if (from_date)   { params.push(from_date);   where.push(`l.entry_date >= $${params.length}`); }
    if (to_date)     { params.push(to_date);     where.push(`l.entry_date <= $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rowsSql = `
      SELECT l.*, a.name AS account_name, a.type AS account_type
        FROM ledger l
        JOIN accounts a ON l.account_id = a.id
        ${whereSql}
       ORDER BY l.entry_date DESC, l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    // Totals span every row matching the filter, not just the page being
    // shown. Sign convention: ledger.amount is positive for money in and
    // negative for money out, which is what v_financial_summary assumes too.
    const totalsSql = `
      SELECT
        COALESCE(SUM(l.amount) FILTER (WHERE l.amount > 0), 0)      AS total_credits,
        COALESCE(SUM(ABS(l.amount)) FILTER (WHERE l.amount < 0), 0) AS total_debits,
        COALESCE(SUM(l.amount), 0)                                  AS net,
        COUNT(*) FILTER (WHERE l.amount > 0)                        AS credit_transactions,
        COUNT(*) FILTER (WHERE l.amount < 0)                        AS debit_transactions,
        COUNT(*)                                                    AS total_transactions
        FROM ledger l
        ${whereSql}`;

    const [result, totalsResult] = await Promise.all([
      query(rowsSql, [...params, limit, offset]),
      // Previously a string-interpolated COUNT, which both ignored the other
      // filters and concatenated account_id straight into SQL.
      query(totalsSql, params),
    ]);

    const t = totalsResult.rows[0];
    return NextResponse.json({
      success: true,
      data: result.rows,
      summary: {
        total_credits: t.total_credits,
        total_debits: t.total_debits,
        net: t.net,
        credit_transactions: Number(t.credit_transactions),
        debit_transactions: Number(t.debit_transactions),
        total_transactions: Number(t.total_transactions),
        // Aliases matching v_financial_summary, for callers using those names.
        total_income: t.total_credits,
        total_expenses: t.total_debits,
        net_position: t.net,
      },
      pagination: { total: Number(t.total_transactions), limit, offset },
    });
  } catch (error) {
    console.error('[Ledger] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ledger' }, { status: 500 });
  }
}

// POST /api/ledger — finance.create (admin only)
export async function POST(request) {
  // finance.ledger_entry gates the elevated "manual ledger entry" action.
  // Falls back to finance.create for backwards compatibility — any role
  // granted either works (and superadmins bypass via requirePermission).
  const perm = await requirePermission(request, 'finance.ledger_entry');
  const finalPerm = perm instanceof NextResponse
    ? await requirePermission(request, 'finance.create')
    : perm;
  if (finalPerm instanceof NextResponse) return finalPerm;
  const { auth } = finalPerm;
  try {

    const body = await request.json();
    const { account_id, amount, currency, description, category, entry_date } = body;
    if (!account_id || !amount || !description) {
      return NextResponse.json({ success: false, error: 'account_id, amount, and description are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO ledger (account_id, amount, currency, source_type, description, category, entry_date, created_by)
       VALUES ($1,$2,$3,'adjustment',$4,$5,$6,$7) RETURNING *`,
      [account_id, amount, currency||'UGX', description, category||'adjustment', entry_date||new Date().toISOString().split('T')[0], auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'ledger_adjustment', result.rows[0].id, JSON.stringify({ amount, description })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Ledger] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create ledger entry' }, { status: 500 });
  }
}
