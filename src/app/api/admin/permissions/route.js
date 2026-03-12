/**
 * GET /api/admin/permissions - List all available permissions grouped by module
 */
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils.js';
import { getAllPermissionsGrouped } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { flat, grouped } = await getAllPermissionsGrouped();

    return NextResponse.json({ success: true, data: flat, grouped });
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch permissions' }, { status: 500 });
  }
}
