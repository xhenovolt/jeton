import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/auth/sessions/invalidate
 * Invalidate all sessions for a user
 */
export async function POST(req) {
  // Was unauthenticated and took an arbitrary user_id, so anyone could force
  // any user — superadmin included — to be logged out. Callers may now only
  // invalidate their OWN sessions unless they can manage users.
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { user_id, reason } = await req.json();

  if (!user_id) {
    return NextResponse.json(
      { error: 'user_id is required' },
      { status: 400 }
    );
  }

  // Invalidating someone else's sessions is an administrative act.
  if (user_id !== auth.userId) {
    const perm = await requirePermission(req, 'users.manage');
    if (perm instanceof NextResponse) return perm;
  }

  try {
    const result = await pool.query(
      `SELECT invalidate_user_sessions($1, $2)`,
      [user_id, reason || 'manual_invalidation']
    );
    
    const invalidatedCount = result.rows[0].invalidate_user_sessions;
    
    return NextResponse.json({
      success: true,
      invalidated_sessions: invalidatedCount
    });
  } catch (error) {
    console.error('Error invalidating sessions:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate sessions: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/sessions/[sessionId]
 * Delete a specific session
 */
export async function DELETE(req, { params }) {
  const { sessionId } = params;
  
  try {
    const result = await pool.query(
      `UPDATE sessions 
       SET invalidated_at = CURRENT_TIMESTAMP, invalidation_reason = 'manual_delete'
       WHERE id = $1
       RETURNING id`,
      [sessionId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
