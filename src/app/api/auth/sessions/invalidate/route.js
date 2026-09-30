import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db.js';
import { guardSuperAdmin } from '@/lib/auth-utils.js';

// Shared, lazily-initialised pool from lib/db (no per-route pools).
const pool = {
  query: (text, params) => getPool().query(text, params),
  connect: () => getPool().connect(),
};

/**
 * POST /api/auth/sessions/invalidate
 * Invalidate all sessions for a user
 */
export async function POST(req) {
  const gate = await guardSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { user_id, reason } = await req.json();
  
  if (!user_id) {
    return NextResponse.json(
      { error: 'user_id is required' },
      { status: 400 }
    );
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
  const gate = await guardSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;

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
