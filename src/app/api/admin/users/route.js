import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, getUserAuthorityLevel, buildAuthorityFilter } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'users.view');
  if (perm instanceof NextResponse) return perm;
  try {
    const { auth } = perm;
    // Hierarchy filter: viewer only sees users whose authority_level <= their own
    const viewerAuthority = auth.role === 'superadmin' ? 100 : await getUserAuthorityLevel(auth.userId);
    const { clause, params } = buildAuthorityFilter(viewerAuthority, {
      actorAuthorityCol: 'u.authority_level',
      startIdx: 1,
    });

    const result = await query(
      `SELECT id, email, name, role, status, is_active, authority_level,
              first_login_completed, last_login, created_at
         FROM users u
        WHERE ${clause}
        ORDER BY u.created_at DESC`,
      params
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
