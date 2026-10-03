import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyWebhookSignature, getCollectionStatus } from '@/lib/marzpay.js';
import { decryptSecret } from '@/lib/encryption.js';

/**
 * POST /api/finance/marzpay/webhook — MarzPay payment callback.
 *
 * Deliberately unauthenticated in the session sense: the caller is MarzPay,
 * not a logged-in user. Trust is established two ways instead:
 *
 *   1. X-MarzPay-Signature, when the account has a webhook secret stored.
 *      HMAC-SHA256 over `${t}.${rawBody}`, 5-minute window, constant-time
 *      comparison.
 *   2. The status is then re-read from MarzPay's own API before anything is
 *      believed. This is what makes the endpoint safe even with no signing
 *      secret configured: the webhook is only a nudge to go and check, never
 *      the source of truth about money.
 *
 * It therefore never credits anything based on the request body alone.
 */
export async function POST(request) {
  // The raw body is required for signature verification — parsing it first
  // would change the bytes the HMAC was computed over.
  const rawBody = await request.text();

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const root = payload?.data ?? payload ?? {};
  const uuid = root.transaction?.uuid ?? root.uuid ?? null;
  const reference = root.transaction?.reference ?? root.reference ?? null;

  if (!uuid && !reference) {
    return NextResponse.json({ success: false, error: 'No transaction identifier in payload' }, { status: 400 });
  }

  try {
    // Resolve which of our accounts this concerns, via the transaction we
    // recorded when the collection was started.
    const known = await query(
      `SELECT t.id, t.account_id, t.status, a.webhook_secret_encrypted
         FROM marzpay_transactions t
         JOIN marzpay_accounts a ON a.id = t.account_id
        WHERE ($1::uuid IS NOT NULL AND t.provider_uuid = $1::uuid)
           OR ($2::text IS NOT NULL AND t.reference = $2::text)
        LIMIT 1`,
      [uuid, reference]
    );

    const row = known.rows[0];
    if (!row) {
      // Unknown transaction: acknowledge so MarzPay stops retrying, but
      // record it for investigation rather than acting on it.
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (NULL,'MARZPAY_WEBHOOK_UNKNOWN','marzpay_transaction',NULL,$1)`,
        [JSON.stringify({ uuid, reference })]
      ).catch(() => {});
      return NextResponse.json({ success: true, message: 'Acknowledged; transaction not recognised' });
    }

    // ── 1. Signature, when a secret is configured ──────────────────────────
    let signature = 'unsigned';
    if (row.webhook_secret_encrypted) {
      let secret = null;
      try { secret = decryptSecret(row.webhook_secret_encrypted); } catch { secret = null; }
      if (secret) {
        signature = verifyWebhookSignature(
          rawBody, request.headers.get('x-marzpay-signature'), secret);
        if (signature === 'invalid') {
          await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (NULL,'MARZPAY_WEBHOOK_BAD_SIGNATURE','marzpay_transaction',$1,$2)`,
            [row.id, JSON.stringify({ uuid, reference })]
          ).catch(() => {});
          return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    // ── 2. Confirm against the API before believing anything ───────────────
    let confirmed = null;
    if (uuid) {
      const check = await getCollectionStatus(row.account_id, uuid);
      if (check.ok) confirmed = check.transaction;
    }

    await query(
      `UPDATE marzpay_transactions
          SET status = COALESCE($2, status),
              provider_reference = COALESCE($3, provider_reference),
              last_status_payload = $4,
              updated_at = NOW()
        WHERE id = $1`,
      [row.id,
       confirmed?.status ?? null,
       root.transaction?.provider_reference ?? null,
       JSON.stringify({ webhook: payload, api_confirmation: confirmed, signature })]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (NULL,'MARZPAY_WEBHOOK','marzpay_transaction',$1,$2)`,
      [row.id, JSON.stringify({
        uuid, reference, signature,
        api_confirmed: !!confirmed,
        status: confirmed?.status ?? null,
      })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      signature,
      api_confirmed: !!confirmed,
      status: confirmed?.status ?? row.status,
    });
  } catch (error) {
    console.error('[MarzPay] webhook error:', error.message);
    // Answer 500 so MarzPay retries rather than dropping the notification.
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
