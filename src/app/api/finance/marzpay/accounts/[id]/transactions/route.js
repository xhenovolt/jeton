import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getTransactions, getCollectionServices, getDisbursementServices } from '@/lib/marzpay.js';

/**
 * GET /api/finance/marzpay/accounts/[id]/transactions
 *
 * Transactions plus the account balance. The balance comes from the
 * /transactions payload rather than MarzPay's dedicated /balance endpoint,
 * which answers 403 IP_WHITELIST_REQUIRED. That is left alone deliberately:
 * on Vercel the function egress IP rotates, so a whitelist would break live
 * collections intermittently. /transactions is not IP-restricted and carries
 * the same figure.
 *
 * ?include=services also returns the collection and disbursement providers
 * this account may actually use, so the UI offers only real capabilities.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '25')));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const includeServices = searchParams.get('include') === 'services';

    const result = await getTransactions(id, { perPage, page });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    const payload = {
      success: true,
      balance: result.balance,
      balance_source: 'transactions_endpoint',
      transactions: result.transactions,
      account_uuid: result.account_uuid,
      pagination: { page, per_page: perPage },
    };

    if (includeServices) {
      const [collect, send] = await Promise.all([
        getCollectionServices(id),
        getDisbursementServices(id),
      ]);
      payload.services = {
        collection: collect.ok ? collect.providers : [],
        disbursement: send.ok ? send.providers : [],
        errors: [
          ...(collect.ok ? [] : [`collection: ${collect.error}`]),
          ...(send.ok ? [] : [`disbursement: ${send.error}`]),
        ],
      };
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error.code === 'MARZPAY_UNDECRYPTABLE' || /cannot be decrypted|could not be decrypted|ENCRYPTION_KEY/.test(error.message)) {
      // A configuration problem, not a server fault. The code lets the UI
      // show the two concrete remedies instead of a bare message.
      return NextResponse.json(
        { success: false, error: error.message, code: error.code || 'MARZPAY_UNDECRYPTABLE' },
        { status: 503 }
      );
    }
    console.error('[MarzPay] transactions error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load MarzPay transactions' }, { status: 500 });
  }
}
