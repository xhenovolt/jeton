import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { createSnapshot } from '@/lib/reports';
import { logAudit } from '@/lib/audit';
import { query } from '@/lib/db.js';

/**
 * POST /api/snapshots/create
 * Create a new financial snapshot (FOUNDER only)
 */
export async function POST(request) {
  try {
    // Get user from session
    const user = await requireApiAuth();

    // Get user record to check role
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [user.userId]
    );
    const userRecord = userResult.rows[0];

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if founder
    if (userRecord.role !== 'FOUNDER') {
      await logAudit({
        actor_id: user.userId,
        action: 'SNAPSHOT_CREATE_DENIED',
        entity: 'snapshot',
        status: 'FAILURE',
        metadata: { reason: 'Not a founder' }
      });

      return NextResponse.json(
        { error: 'Forbidden: Only founders can create snapshots' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type = 'MANUAL' } = body;

    const validTypes = ['NET_WORTH', 'PIPELINE_VALUE', 'FINANCIAL_SUMMARY', 'MANUAL'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid snapshot type' },
        { status: 400 }
      );
    }

    const snapshot = await createSnapshot(type, user.userId);

    await logAudit({
      actor_id: user.userId,
      action: 'SNAPSHOT_CREATE',
      entity: 'snapshot',
      entity_id: snapshot.id,
      metadata: { type },
      status: 'SUCCESS'
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) throw error;
    console.error('Error in POST /api/snapshots/create:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
