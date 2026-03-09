/**
 * GET /api/admin/permissions - List all available permissions grouped by module
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
    }

    const result = await query('SELECT id, module, action, description FROM permissions ORDER BY module, action');

    // Group by module
    const grouped = {};
    for (const perm of result.rows) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }

    return NextResponse.json({ success: true, data: result.rows, grouped });
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch permissions' }, { status: 500 });
  }
}
