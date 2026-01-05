import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { getSnapshot } from '@/lib/reports';

/**
 * GET /api/snapshots/[id]
 * Get a specific snapshot
 */
export async function GET(request, { params }) {
  try {
    // Get user from session
    const user = await requireApiAuth();

    const { id } = await params;
    const snapshot = await getSnapshot(id);

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof NextResponse) throw error;
    console.error('Error in GET /api/snapshots/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshot' },
      { status: 500 }
    );
  }
}
