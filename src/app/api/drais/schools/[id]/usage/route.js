/**
 * GET /api/drais/schools/[id]/usage
 * Per-school usage from DRAIS: learners, staff, SMS, storage (Cloudinary),
 * and DB footprint (rows). Requires drais.view.
 */
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getUsage } from '@/lib/drais-platform.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { id } = params;
    const r = await getUsage(id);
    return NextResponse.json({ success: true, data: r?.data ?? null });
  } catch (error) {
    console.error('[DRAIS] GET /schools/[id]/usage error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load usage' }, { status: 503 });
  }
}
