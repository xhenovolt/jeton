/**
 * DRAIS API Client (compatibility facade).
 *
 * HISTORY: this used to target the legacy /api/external/* surface with
 * x-api-key + x-api-secret headers and a placeholder base URL — which never
 * matched the real DRAIS contract (bearer keyId.secret over /api/platform/v1)
 * and so 401'd in practice.
 *
 * NOW: it delegates to src/lib/drais-platform.js — the single, correct
 * transport (bearer auth, retries, idempotency, observability logging). The
 * exported function names + DRAISResponse shape are preserved so the existing
 * /api/drais/* proxy routes keep working unchanged, now over the right surface.
 */
// drais-platform.js is plain JS (this is a JS project); types are best-effort.
// @ts-ignore
import * as platform from './drais-platform.js';

interface DRAISSchool {
  id: string;
  external_id: string;
  name: string;
  status: 'active' | 'suspended' | 'inactive' | string;
  created_at?: string;
  updated_at?: string;
  last_activity?: string;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  monthly_price?: number;
  plan?: any;
}

interface DRAISAuditLog {
  id: string;
  school_id?: string;
  school_name?: string;
  action: string;
  user_id?: string;
  user_email?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface DRAISResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

function ok<T>(data: T): DRAISResponse<T> { return { success: true, data }; }
function err<T>(e: any): DRAISResponse<T> {
  return { success: false, error: e?.message || 'DRAIS request failed' };
}

function normalizeSchool(item: any): DRAISSchool {
  return {
    id:                  item?.external_id ?? item?.id,
    external_id:         item?.external_id ?? item?.id,
    name:                item?.name,
    status:              item?.status,
    created_at:          item?.created_at,
    updated_at:          item?.updated_at,
    subscription_plan:   item?.subscription_plan ?? null,
    subscription_status: item?.subscription_status ?? null,
    plan:                item?.plan ?? null,   // { plan_kind, is_trial, label, days_remaining, expires_at, expiring_soon, expired }
  };
}

/** SCHOOL MANAGEMENT */
export async function getSchools(): Promise<DRAISResponse<DRAISSchool[]>> {
  try {
    const r = await platform.listSchools('?limit=100');
    const items = Array.isArray(r?.data?.items) ? r.data.items : [];
    return ok(items.map(normalizeSchool));
  } catch (e) { return err(e); }
}

export async function getSchoolById(schoolId: string): Promise<DRAISResponse<DRAISSchool>> {
  try { const r = await platform.getSchool(schoolId); return ok(normalizeSchool(r?.data)); }
  catch (e) { return err(e); }
}

export async function updateSchool(
  schoolId: string,
  payload: Partial<DRAISSchool>,
): Promise<DRAISResponse<DRAISSchool>> {
  try {
    // Platform PATCH /schools/{id} accepts name/email/phone only.
    const body: Record<string, any> = {};
    for (const k of ['name', 'email', 'phone']) if ((payload as any)[k] !== undefined) body[k] = (payload as any)[k];
    const r = await platform.patch(`/schools/${encodeURIComponent(schoolId)}`, body);
    return ok(normalizeSchool(r?.data));
  } catch (e) { return err(e); }
}

export async function suspendSchool(schoolId: string): Promise<DRAISResponse<DRAISSchool>> {
  try { const r = await platform.suspendSchool(schoolId, 'suspended via Jeton'); return ok(r?.data); }
  catch (e) { return err(e); }
}

export async function activateSchool(schoolId: string): Promise<DRAISResponse<DRAISSchool>> {
  try { const r = await platform.reactivateSchool(schoolId); return ok(r?.data); }
  catch (e) { return err(e); }
}

/** PRICING / SUBSCRIPTION */
export async function updateSchoolPricing(
  schoolId: string,
  pricing: { subscription_plan: string; monthly_price?: number },
): Promise<DRAISResponse<DRAISSchool>> {
  try {
    // Maps to PUT /subscriptions/{id} (subscription_plan). monthly_price is not
    // a platform field — Jeton owns billing amounts in its own Postgres.
    const r = await platform.setSubscription(schoolId, { subscription_plan: pricing.subscription_plan });
    return ok(r?.data);
  } catch (e) { return err(e); }
}

/** ACTIVITY MONITORING */
export async function getAuditLogs(
  q?: { school_id?: string; start_date?: string; end_date?: string; limit?: number; offset?: number },
): Promise<DRAISResponse<DRAISAuditLog[]>> {
  try {
    const params = new URLSearchParams();
    if (q?.limit) params.append('limit', String(q.limit));
    if (q?.school_id) params.append('school', q.school_id);
    const qs = params.toString() ? `?${params}` : '';
    const r = await platform.getAudit(qs);
    const items = Array.isArray(r?.data?.items) ? r.data.items : (Array.isArray(r?.data) ? r.data : []);
    return ok(items);
  } catch (e) { return err(e); }
}

/** HEALTH */
export async function healthCheck(): Promise<DRAISResponse<{ status: string }>> {
  try { const r = await platform.health(); return ok({ status: r?.data?.status ?? 'ok' }); }
  catch (e) { return err(e); }
}

export type { DRAISSchool, DRAISAuditLog, DRAISResponse };
