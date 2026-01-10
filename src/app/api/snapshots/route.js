import { getSnapshots, getSnapshot } from '@/lib/reports';

/**
 * GET /api/snapshots
 * Get all snapshots
 */
export async function GET(request) {
  try {
    // Get optional type filter from query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const snapshots = await getSnapshots(type);

    return Response.json({
      success: true,
      data: snapshots,
      count: snapshots.length
    });
  } catch (error) {
    console.error('Error in GET /api/snapshots:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
