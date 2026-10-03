import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { verifyAccount } from '@/lib/marzpay.js';

/**
 * POST /api/finance/marzpay/accounts/[id]/verify
 *
 * Credential check. Calls GET /collect-money/services, which moves no money,
 * and records the outcome plus MarzPay's own account uuid on the row.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const result = await verifyAccount(id);
    // A rejection is a real answer about the credentials, not a server fault,
    // so it comes back 200 with ok:false rather than a 5xx.
    return NextResponse.json({ success: result.ok, ...result });
  } catch (error) {
    if (/ENCRYPTION_KEY|could not be decrypted/.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    console.error('[MarzPay] verify error:', error.message);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
