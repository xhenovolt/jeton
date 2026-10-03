import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { listAccounts, createAccount } from '@/lib/marzpay.js';

/**
 * GET /api/finance/marzpay/accounts — list MarzPay accounts.
 *
 * Returns metadata and a masked key only. Ciphertext never leaves the server,
 * and there is no endpoint anywhere that returns a decrypted credential.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    return NextResponse.json({ success: true, data: await listAccounts() });
  } catch (error) {
    console.error('[MarzPay] accounts GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load MarzPay accounts' }, { status: 500 });
  }
}

/**
 * POST /api/finance/marzpay/accounts — register another MarzPay account.
 *
 * This is the whole point of the database-backed model: a new account needs no
 * .env change and no redeploy.
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const { name, description, environment, base_url, api_key, api_secret, webhook_secret, is_default } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    if (!api_key?.trim() || !api_secret?.trim()) {
      return NextResponse.json({ success: false, error: 'api_key and api_secret are required' }, { status: 400 });
    }
    if (environment && !['live', 'sandbox'].includes(environment)) {
      return NextResponse.json({ success: false, error: "environment must be 'live' or 'sandbox'" }, { status: 400 });
    }

    // Only one account may be the default, so clear the flag before claiming it.
    if (is_default) await query(`UPDATE marzpay_accounts SET is_default = FALSE`);

    const account = await createAccount({
      name, description, environment, base_url,
      api_key, api_secret, webhook_secret,
      is_default: !!is_default, userId: auth.userId,
    });

    // Audit the registration. The credential itself is never recorded — only
    // the masked form that is already safe to display.
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'CREATE','marzpay_account',$2,$3)`,
      [auth.userId, account.id,
       JSON.stringify({ name: account.name, environment: account.environment, api_key_masked: account.api_key_masked })]
    ).catch(() => {});

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    // A unique violation here means these credentials are already registered.
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'An account with these credentials already exists for this environment.' },
        { status: 409 });
    }
    if (/ENCRYPTION_KEY/.test(error.message)) {
      return NextResponse.json(
        { success: false, error: 'ENCRYPTION_KEY is not configured on the server, so credentials cannot be stored securely.' },
        { status: 500 });
    }
    console.error('[MarzPay] accounts POST error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to create MarzPay account' }, { status: 500 });
  }
}
