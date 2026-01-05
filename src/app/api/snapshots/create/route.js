import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { createSnapshot } from '@/lib/reports';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/snapshots/create
 * Create a new financial snapshot (FOUNDER only)
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if founder
    if (payload.role !== 'FOUNDER') {
      await logAudit({
        actor_id: payload.userId,
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

    const snapshot = await createSnapshot(type, payload.userId);

    await logAudit({
      actor_id: payload.userId,
      action: 'SNAPSHOT_CREATE',
      entity: 'snapshot',
      entity_id: snapshot.id,
      metadata: { type },
      status: 'SUCCESS'
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/snapshots/create:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
