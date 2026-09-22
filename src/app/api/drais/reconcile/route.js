/**
 * POST /api/drais/reconcile  — subscription-expiry reconciliation.
 *
 * The reliable half of "suspend schools when their subscription expires"
 * (the webhook receiver handles the real-time push; this is the safety net
 * that self-heals if a webhook was missed, and works even if DRAIS isn't
 * emitting subscription.expired yet).
 *
 * Lists schools, and for every ACTIVE school whose subscription has lapsed,
 * calls DRAIS suspend. Read-then-write entirely over the platform API — no DB
 * touch. Gated by drais.control (destructive).
 */
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { listSchools, getSubscription, suspendSchool } from '@/lib/drais-platform.js';

export const runtime = 'nodejs';

function isLapsed(sub) {
  if (!sub) return false;
  const now = Date.now();
  const status = (sub.subscription_status || '').toLowerCase();
  if (status === 'expired' || status === 'cancelled' || status === 'canceled') return true;
  // Trial that has ended.
  if (status === 'trial' && sub.trial_end_date && new Date(sub.trial_end_date).getTime() < now) return true;
  // Paid window elapsed.
  if (sub.subscription_end_date && new Date(sub.subscription_end_date).getTime() < now) return true;
  return false;
}

export async function POST(request) {
  const perm = await requirePermission(request, 'drais.control');
  if (perm instanceof NextResponse) return perm;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry_run') === '1';

  const checked = [];
  let suspended = 0, failed = 0;
  try {
    // Page through active schools.
    let cursor = null;
    for (let page = 0; page < 50; page++) {
      const qs = `?status=active&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      const r = await listSchools(qs);
      const items = r?.data?.items ?? [];
      for (const s of items) {
        let sub = null;
        try { sub = (await getSubscription(s.external_id))?.data; } catch { /* skip on read error */ }
        if (!isLapsed(sub)) continue;
        const entry = { external_id: s.external_id, name: s.name, reason: sub?.subscription_status || 'lapsed' };
        if (dryRun) { entry.action = 'would_suspend'; checked.push(entry); continue; }
        try {
          const resp = await suspendSchool(s.external_id, 'subscription expired (auto, reconcile)');
          entry.action = resp?.ok ? 'suspended' : 'suspend_failed';
          if (resp?.ok) suspended++; else failed++;
        } catch (e) { entry.action = `error:${e?.message ?? 'unknown'}`; failed++; }
        checked.push(entry);
      }
      cursor = r?.data?.next_cursor ?? null;
      if (!cursor) break;
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || 'reconcile failed', checked }, { status: 502 });
  }

  return NextResponse.json({ success: true, dry_run: dryRun, lapsed: checked.length, suspended, failed, schools: checked });
}
