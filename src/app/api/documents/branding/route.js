import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getActiveBranding, updateBranding } from '@/lib/company-branding.js';

// GET /api/documents/branding - Get active branding
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const branding = await getActiveBranding();
    return NextResponse.json({ success: true, data: branding });
  } catch (error) {
    console.error('[Branding] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}

// POST /api/documents/branding - Update branding
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'documents.branding');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const data = await request.json();

    const branding = await updateBranding(data, auth.userId);

    return NextResponse.json({
      success: true,
      message: 'Branding updated successfully',
      data: branding,
    });
  } catch (error) {
    console.error('[Branding] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branding: ' + error.message },
      { status: 500 }
    );
  }
}
