/**
 * GET /api/drais/schools/[id]/staff
 * Per-school staff directory from DRAIS (name/role/dept/status). Requires drais.view.
 */
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { getStaff } from '@/lib/drais-platform.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'drais.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { id } = params;
    const r = await getStaff(id);
    return NextResponse.json({ success: true, data: r?.data ?? null });
  } catch (error) {
    console.error('[DRAIS] GET /schools/[id]/staff error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load staff' }, { status: 503 });
  }
}
