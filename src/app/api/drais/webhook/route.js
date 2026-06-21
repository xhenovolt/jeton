/**
 * POST /api/drais/webhook  — inbound DRAIS platform webhook receiver.
 *
 * - Verifies X-DRAIS-Signature (HMAC) against DRAIS_WEBHOOK_SECRET.
 * - Idempotent by X-DRAIS-Delivery-Id (drais_webhook_events.delivery_id UNIQUE).
 * - Auto-suspends a school the moment its subscription expires — the core of
 *   the "control DRAIS from Jeton without logging into each school" goal.
 * - Records every delivery for audit; returns 2xx fast so DRAIS doesn't retry.
 *
 * No session/permission gate here: authenticity is the HMAC signature, not a
 * Jeton login (DRAIS is the caller, not a user).
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyWebhookSignature } from '@/lib/drais-webhook.js';
import { suspendSchool } from '@/lib/drais-platform.js';

export const runtime = 'nodejs';

function extractExternalId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.external_id
      || payload.school_external_id
      || payload.school?.external_id
      || null;
}

export async function POST(request) {
  const rawBody = await request.text();
  const sigHeader  = request.headers.get('x-drais-signature');
  const eventType  = request.headers.get('x-drais-event') || 'unknown';
  const deliveryId = request.headers.get('x-drais-delivery-id') || null;
  const secret = process.env.DRAIS_WEBHOOK_SECRET;

  // No secret configured → can't trust anything. 503 so DRAIS retries later.
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 });
  }

  const verdict = verifyWebhookSignature(rawBody, sigHeader, secret);
  if (!verdict.ok) {
    // Do not persist unverified payloads (could be spoofed).
    return NextResponse.json({ error: 'invalid signature', reason: verdict.reason }, { status: 401 });
  }

  let payload = null;
  try { payload = rawBody ? JSON.parse(rawBody) : null; } catch { /* keep null */ }
  const externalId = extractExternalId(payload);

  // Idempotent insert: a duplicate delivery is a no-op (DRAIS retries safely).
  const ins = await query(
    `INSERT INTO drais_webhook_events
       (delivery_id, event_type, external_id, payload, signature_valid)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (delivery_id) DO NOTHING
     RETURNING id`,
    [deliveryId, eventType, externalId, payload],
  );
  if (ins.rowCount === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const rowId = ins.rows[0].id;

  // ── Process the event ──────────────────────────────────────────────────
  let result = 'noop';
  try {
    if (eventType === 'subscription.expired' && externalId) {
      const resp = await suspendSchool(externalId, 'subscription expired (auto, via Jeton webhook)');
      result = resp?.ok ? 'suspended' : `suspend_failed:${resp?.data?.status ?? 'unknown'}`;
    } else {
      // school.suspended/reactivated/updated, subscription.changed/expiring,
      // payment.received, sms.balance.low, etc. — recorded for the dashboards;
      // reconciliation + UI read drais_webhook_events. Add handlers as needed.
      result = 'recorded';
    }
  } catch (e) {
    result = `error:${e?.message ?? 'unknown'}`;
  }

  await query(
    `UPDATE drais_webhook_events SET processed = TRUE, process_result = $1, processed_at = NOW() WHERE id = $2`,
    [result, rowId],
  );

  return NextResponse.json({ ok: true, event: eventType, result });
}
