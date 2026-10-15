import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getProviderSnapshot, getServicesCached } from '@/lib/marzpay.js';

/**
 * GET /api/finance/marzpay/accounts/[id]/transactions
 *
 * Live balance and transactions from MarzPay, in ONE provider call.
 *
 * This route used to make three: /transactions, plus /collect-money/services
 * and /send-money/services whenever ?include=services was passed — which the
 * page passed on every load. Together with the account list and the accounting
 * summary that came to five-to-twenty-four calls per render, repeated on a
 * timer, and MarzPay throttled it ("Too Many Attempts."). The throttle then
 * blocked starting a collection, which is the point of the page.
 *
 * /transactions already carries the balance, so one request answers both. The
 * service catalogue is cached for ten minutes because it is effectively static.
 *
 * ?force=1 bypasses the 20s read cache, for the Refresh button.
 *
 * The balance is still live — read_at says exactly when, and `cached` says
 * whether it came from the short cache. A figure a few seconds old and stamped
 * as such is honest; a cached figure presented as current is not.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1';
    const includeServices = searchParams.get('include') === 'services';

    const snap = await getProviderSnapshot(id, { force });

    if (!snap.ok) {
      // A throttle is a "come back shortly", not a server fault, and must not
      // be retried by the client.
      if (snap.rate_limited) {
        return NextResponse.json({
          success: false,
          error: snap.error,
          code: 'MARZPAY_RATE_LIMITED',
          retry_in_ms: snap.retry_in_ms ?? null,
        }, { status: 429 });
      }
      return NextResponse.json({ success: false, error: snap.error }, { status: 502 });
    }

    const payload = {
      success: true,
      balance: snap.balance,
      balance_source: 'transactions_endpoint',
      transactions: snap.transactions,
      summary: snap.summary,
      account_uuid: snap.account_uuid,
      read_at: snap.read_at,
      cached: snap.cached,
      rate_limited: snap.rate_limited,
      retry_in_ms: snap.retry_in_ms ?? null,
    };

    if (includeServices) {
      const services = await getServicesCached(id);
      payload.services = {
        collection: services.collection ?? [],
        disbursement: services.disbursement ?? [],
        errors: services.errors ?? [],
        cached: !!services.cached,
      };
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error.code === 'MARZPAY_UNDECRYPTABLE' || /cannot be decrypted|could not be decrypted|ENCRYPTION_KEY/.test(error.message)) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code || 'MARZPAY_UNDECRYPTABLE' },
        { status: 409 }
      );
    }
    console.error('[MarzPay] transactions error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load MarzPay transactions' }, { status: 500 });
  }
}
