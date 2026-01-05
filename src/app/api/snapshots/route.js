import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { getSnapshots, getSnapshot } from '@/lib/reports';

/**
 * GET /api/snapshots
 * Get all snapshots
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await requireApiAuth();

    // Get optional type filter from query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const snapshots = await getSnapshots(type);

    return NextResponse.json({
      snapshots,
      count: snapshots.length
    });
  } catch (error) {
    if (error instanceof NextResponse) throw error;
    console.error('Error in GET /api/snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
