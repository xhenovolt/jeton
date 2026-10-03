import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getAccountPublic, rotateCredentials, setDefaultAccount } from '@/lib/marzpay.js';

// GET /api/finance/marzpay/accounts/[id] — metadata only, never credentials
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'finance.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const account = await getAccountPublic(id);
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error('[MarzPay] account GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load account' }, { status: 500 });
  }
}

/**
 * PATCH /api/finance/marzpay/accounts/[id]
 *
 * Handles metadata edits, credential rotation and making an account the
 * default. Rotation exists here specifically so a leaked key can be replaced
 * from the UI without a redeploy.
 */
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json();

    const before = await getAccountPublic(id);
    if (!before) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });

    // ── Credential rotation ────────────────────────────────────────────────
    const rotating = body.api_key || body.api_secret || body.webhook_secret !== undefined;
    if (rotating) {
      await rotateCredentials(id, {
        api_key: body.api_key,
        api_secret: body.api_secret,
        webhook_secret: body.webhook_secret,
      });
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'ROTATE_CREDENTIALS','marzpay_account',$2,$3)`,
        [auth.userId, id, JSON.stringify({
          name: before.name,
          rotated: Object.keys({
            ...(body.api_key ? { api_key: 1 } : {}),
            ...(body.api_secret ? { api_secret: 1 } : {}),
            ...(body.webhook_secret !== undefined ? { webhook_secret: 1 } : {}),
          }),
        })]
      ).catch(() => {});
    }

    // ── Default flag ───────────────────────────────────────────────────────
    if (body.is_default === true) await setDefaultAccount(id);

    // ── Plain metadata ─────────────────────────────────────────────────────
    const editable = ['name', 'description', 'base_url', 'is_active', 'environment'];
    const sets = [];
    const vals = [];
    for (const f of editable) {
      if (body[f] === undefined) continue;
      if (f === 'environment' && !['live', 'sandbox'].includes(body[f])) {
        return NextResponse.json({ success: false, error: "environment must be 'live' or 'sandbox'" }, { status: 400 });
      }
      vals.push(body[f]);
      sets.push(`${f} = $${vals.length}`);
    }
    if (sets.length) {
      sets.push('updated_at = NOW()');
      vals.push(id);
      await query(`UPDATE marzpay_accounts SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    }

    if (!rotating && body.is_default !== true && !sets.length) {
      return NextResponse.json({ success: false, error: 'No changes supplied' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: await getAccountPublic(id) });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Those credentials are already registered.' }, { status: 409 });
    }
    console.error('[MarzPay] account PATCH error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 });
  }
}

/**
 * DELETE /api/finance/marzpay/accounts/[id]
 *
 * marzpay_transactions.account_id is RESTRICT, so an account that has moved
 * money cannot be removed — that history has to stay attributable. Deactivate
 * it instead, which stops it being used while keeping the record.
 */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'finance.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const before = await getAccountPublic(id);
    if (!before) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });

    const used = await query(
      `SELECT COUNT(*)::int AS n FROM marzpay_transactions WHERE account_id = $1`, [id]);
    if (used.rows[0].n > 0) {
      return NextResponse.json({
        success: false,
        code: 'ACCOUNT_HAS_TRANSACTIONS',
        error: `This account has ${used.rows[0].n} recorded transaction(s), so it cannot be deleted — that payment history must stay attributable. Deactivate it instead to stop it being used.`,
        transactions: used.rows[0].n,
      }, { status: 409 });
    }

    await query(`DELETE FROM marzpay_accounts WHERE id = $1`, [id]);
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DELETE','marzpay_account',$2,$3)`,
      [auth.userId, id, JSON.stringify({ name: before.name, api_key_masked: before.api_key_masked })]
    ).catch(() => {});

    return NextResponse.json({ success: true, message: 'MarzPay account removed' });
  } catch (error) {
    console.error('[MarzPay] account DELETE error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
  }
}
