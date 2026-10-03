import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getAccountingSummary, getUnreconciled, reconcile } from '@/lib/marzpay.js';

/**
 * GET /api/finance/marzpay/reconcile?account_id=...
 *
 * The accounting position for MarzPay: credits, debits and net in the same
 * shape /finance/ledger uses, plus what is still waiting to be posted into
 * the internal ledger.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const accountId = new URL(request.url).searchParams.get('account_id');
    const [summary, pending] = await Promise.all([
      getAccountingSummary(accountId),
      getUnreconciled(accountId),
    ]);

    // What the internal books currently hold for the mapped account, so the UI
    // can show provider-side and book-side figures next to each other rather
    // than asking the user to trust one of them.
    const booked = await query(
      `SELECT COALESCE(SUM(l.amount), 0) AS ledger_total, COUNT(l.id)::int AS ledger_entries
         FROM marzpay_accounts ma
         JOIN ledger l ON l.account_id = ma.ledger_account_id
        WHERE ($1::uuid IS NULL OR ma.id = $1::uuid)`,
      [accountId || null]
    );

    return NextResponse.json({
      success: true,
      summary,
      unreconciled: pending.map(p => ({
        id: p.id, reference: p.reference, amount: Number(p.amount),
        currency: p.currency, phone_number: p.phone_number,
        provider: p.provider, description: p.description, created_at: p.created_at,
        mapped: !!p.ledger_account_id,
      })),
      books: {
        ledger_total: Number(booked.rows[0].ledger_total),
        ledger_entries: booked.rows[0].ledger_entries,
      },
    });
  } catch (error) {
    console.error('[MarzPay] reconcile GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load the reconciliation position' }, { status: 500 });
  }
}

/**
 * POST /api/finance/marzpay/reconcile
 *
 * Post completed collections into the internal ledger. Writing to the books is
 * a finance.manage action. Safe to run repeatedly: ledger_entry_id is checked
 * inside each transaction and enforced by a unique index, so nothing posts
 * twice.
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await reconcile({ accountId: body.account_id || null, userId: auth.userId });

    if (result.posted > 0) {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'MARZPAY_RECONCILE','ledger',NULL,$2)`,
        [auth.userId, JSON.stringify({
          considered: result.considered,
          posted: result.posted,
          amount_posted: result.amount_posted,
          references: result.results.filter(r => r.posted).map(r => r.reference),
        })]
      ).catch(() => {});
    }

    const failures = result.results.filter(r => !r.posted && r.error !== 'Already reconciled');
    return NextResponse.json({
      success: true,
      ...result,
      message: result.posted === 0
        ? (result.considered === 0
            ? 'Nothing to reconcile — every completed collection is already in the ledger.'
            : 'Nothing was posted. See the per-transaction errors.')
        : `Posted ${result.posted} collection(s) totalling ${result.amount_posted.toLocaleString()} to the ledger.`,
      failures,
    });
  } catch (error) {
    console.error('[MarzPay] reconcile POST error:', error.message);
    return NextResponse.json({ success: false, error: 'Reconciliation failed' }, { status: 500 });
  }
}
