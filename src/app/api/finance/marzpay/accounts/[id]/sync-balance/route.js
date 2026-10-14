import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { syncBalanceToLedger } from '@/lib/marzpay.js';

/**
 * POST /api/finance/marzpay/accounts/[id]/sync-balance
 *
 * Posts the difference between MarzPay's balance and the internal account's
 * ledger balance as a single adjustment, so /finance/accounts stops reading
 * zero for a wallet that holds real money.
 *
 * Writing to the books, so finance.manage. Safe to run repeatedly: it posts
 * the gap, and a second run finds no gap.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const result = await syncBalanceToLedger({ accountId: id, userId: auth.userId });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (result.posted) {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'MARZPAY_BALANCE_SYNC','ledger',$2,$3)`,
        [auth.userId, result.ledger_entry_id, JSON.stringify({
          marzpay_account_id: id,
          provider_balance: result.provider_balance,
          book_balance: result.book_balance,
          adjustment: result.difference,
          currency: result.currency,
        })]
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error.code === 'MARZPAY_UNDECRYPTABLE') {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code }, { status: 409 });
    }
    console.error('[MarzPay] balance sync error:', error.message);
    return NextResponse.json({ success: false, error: 'Balance sync failed' }, { status: 500 });
  }
}
