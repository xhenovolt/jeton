import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { getSnapshots, getSnapshot } from '@/lib/reports';

/**
 * GET /api/snapshots
 * Get all snapshots
 */
export async function GET(request) {
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

    // Get optional type filter from query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const snapshots = await getSnapshots(type);

    return NextResponse.json({
      snapshots,
      count: snapshots.length
    });
  } catch (error) {
    console.error('Error in GET /api/snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
