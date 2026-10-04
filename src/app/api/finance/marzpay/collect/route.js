import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { collectMoney, getCollectionStatus } from '@/lib/marzpay.js';

/**
 * POST /api/finance/marzpay/collect — request money from a customer.
 *
 * This is the only route here that moves money, so it is the strictest:
 *   - finance.manage required (not finance.view)
 *   - amount and phone validated before the provider is called
 *   - `reference` is an idempotency key. The row is written first and the
 *     column is UNIQUE, so a double submit returns the original attempt
 *     instead of prompting the customer twice.
 *   - every attempt is audited, success or failure
 *
 * Body: { amount, phone, description?, reference?, account_id?, deal_id?, callback_url? }
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const { amount, phone, description, reference, account_id, deal_id, callback_url } = body;

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be a positive number' }, { status: 400 });
    }
    // Uganda mobile numbers, with or without the country code.
    if (!phone || !/^(\+?256|0)?7\d{8}$/.test(String(phone).replace(/[\s-]/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'phone must be a valid Ugandan mobile number' }, { status: 400 });
    }

    // Prefer an explicit public origin; fall back to this request's origin so
    // callbacks still work in development.
    const origin = process.env.APP_PUBLIC_URL?.trim() || new URL(request.url).origin;
    const callbackUrl = callback_url || `${origin.replace(/\/+$/, '')}/api/finance/marzpay/webhook`;

    const result = await collectMoney({
      accountId: account_id || null,
      amount: amt,
      phone: String(phone).replace(/[\s-]/g, ''),
      description: description || 'Jeton collection',
      reference: reference || null,
      callbackUrl,
      metadata: deal_id ? [{ deal_id: String(deal_id) }] : [],
      userId: auth.userId,
    });

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'MARZPAY_COLLECT','marzpay_transaction',$2,$3)`,
      [auth.userId, result.local_id ?? null,
       JSON.stringify({
         amount: amt, currency: 'UGX',
         // Keep only the last four digits: enough to reconcile, not a full
         // customer phone number sitting in the audit log.
         phone_last4: String(phone).slice(-4),
         reference: result.reference ?? reference ?? null,
         outcome: result.ok ? 'initiated' : (result.duplicate ? 'duplicate' : 'failed'),
         error: result.ok ? null : result.error,
       })]
    ).catch(() => {});

    if (result.duplicate) {
      return NextResponse.json({ ...result, success: false }, { status: 409 });
    }
    if (!result.ok) {
      // The provider refused. That is not a server fault, so 502 rather than 500.
      return NextResponse.json({ success: false, error: result.error, reference: result.reference }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: 'Collection requested. The customer has been prompted to approve the payment.',
      reference: result.reference,
      transaction: result.transaction,
    }, { status: 201 });
  } catch (error) {
    if (error.code === 'MARZPAY_UNDECRYPTABLE' || /cannot be decrypted|could not be decrypted|ENCRYPTION_KEY/.test(error.message)) {
      // A configuration problem, not a server fault. The code lets the UI
      // show the two concrete remedies instead of a bare message.
      return NextResponse.json(
        { success: false, error: error.message, code: error.code || 'MARZPAY_UNDECRYPTABLE' },
        { status: 503 }
      );
    }
    console.error('[MarzPay] collect error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to request the collection' }, { status: 500 });
  }
}

/**
 * GET /api/finance/marzpay/collect?uuid=...&account_id=...
 *
 * Authoritative status straight from MarzPay. Used for reconciliation and as
 * the fallback when a webhook never arrives.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');
    if (!uuid) return NextResponse.json({ success: false, error: 'uuid is required' }, { status: 400 });

    const result = await getCollectionStatus(searchParams.get('account_id') || null, uuid);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });

    return NextResponse.json({ success: true, transaction: result.transaction });
  } catch (error) {
    console.error('[MarzPay] collect status error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to read the collection status' }, { status: 500 });
  }
}
