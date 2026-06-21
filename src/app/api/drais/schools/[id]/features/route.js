/**
 * GET  /api/drais/schools/[id]/features  — read SMS kill-switch + module flags (drais.view)
 * PUT  /api/drais/schools/[id]/features  — toggle them remotely            (drais.control)
 *
 * Body for PUT: { sms_enabled?: boolean, modules?: { [code]: boolean } }
 */
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getFeatures, setFeatures } from '@/lib/drais-platform.js';
import { dispatch } from '@/lib/system-events.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { id } = params;
    const r = await getFeatures(id);
    return NextResponse.json({ success: true, data: r?.data ?? null });
  } catch (error) {
    console.error('[DRAIS] GET /schools/[id]/features error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load features' }, { status: 503 });
  }
}

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'drais.control');
  if (perm instanceof NextResponse) return perm;
  try {
    const { id } = params;
    const { auth } = perm;
    const body = await request.json().catch(() => ({}));
    const changes = {};
    if (typeof body.sms_enabled === 'boolean') changes.sms_enabled = body.sms_enabled;
    if (body.modules && typeof body.modules === 'object') changes.modules = body.modules;
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ success: false, error: 'Provide sms_enabled and/or modules' }, { status: 400 });
    }
    const r = await setFeatures(id, changes);
    try {
      await dispatch({
        type: 'DRAIS_FEATURES_CHANGED',
        userId: auth.userId,
        metadata: { schoolId: id, changes, timestamp: new Date().toISOString() },
      });
    } catch (logError) { console.warn('[DRAIS] features event log failed:', logError); }
    return NextResponse.json({ success: true, data: r?.data ?? null });
  } catch (error) {
    console.error('[DRAIS] PUT /schools/[id]/features error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update features' }, { status: 503 });
  }
}
