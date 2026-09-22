/**
 * GET  /api/drais/webhooks  — list webhooks registered with DRAIS + local config (drais.view)
 * POST /api/drais/webhooks  — register THIS Jeton's receiver with DRAIS       (drais.control)
 *
 * POST body: { url?: string, event_types?: string[] }
 *   url defaults to the request origin + /api/drais/webhook.
 * DRAIS mints + returns the signing secret; we store it (encrypted) so the
 * receiver can verify inbound signatures. The secret is never returned to the UI.
 */
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { listWebhooks, registerWebhook } from '@/lib/drais-platform.js';
import { saveWebhookConfig, getWebhookConfigStatus } from '@/lib/drais-webhook-store.js';

export const runtime = 'nodejs';

export async function GET(request) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const [remote, local] = await Promise.all([
      listWebhooks().catch((e) => ({ error: e?.message })),
      getWebhookConfigStatus().catch(() => null),
    ]);
    return NextResponse.json({
      success: true,
      registered: remote?.data?.items ?? remote?.data ?? [],
      local_config: local,           // { subscription_id, url, event_types, created_at } or null
      receiver_configured: !!local,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to list webhooks' }, { status: 503 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, 'drais.control');
  if (perm instanceof NextResponse) return perm;
  try {
    const body = await request.json().catch(() => ({}));
    const origin = new URL(request.url).origin;
    const url = (body.url && String(body.url).trim()) || `${origin}/api/drais/webhook`;
    if (!/^https:\/\//.test(url)) {
      return NextResponse.json(
        { success: false, error: 'Webhook URL must be https:// and publicly reachable by DRAIS (localhost will not work).' },
        { status: 400 },
      );
    }
    const eventTypes = Array.isArray(body.event_types) && body.event_types.length ? body.event_types : ['*'];

    const r = await registerWebhook(url, eventTypes);
    const data = r?.data || {};
    if (!data.secret) {
      return NextResponse.json({ success: false, error: 'DRAIS did not return a secret', data }, { status: 502 });
    }
    await saveWebhookConfig({
      subscriptionId: data.id != null ? String(data.id) : null,
      url, eventTypes, secret: data.secret,
    });
    return NextResponse.json({
      success: true,
      message: 'Webhook registered. Jeton will now receive DRAIS events (auto-suspend on expiry).',
      subscription_id: data.id ?? null,
      url, event_types: eventTypes,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to register webhook' }, { status: 503 });
  }
}
