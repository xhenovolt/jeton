import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const result = await query(`SELECT id, email, name, role, status, is_active, last_login, created_at FROM users ORDER BY created_at DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
