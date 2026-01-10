import { getSnapshot } from '@/lib/reports';

/**
 * GET /api/snapshots/[id]
 * Get a specific snapshot
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const snapshot = await getSnapshot(id);

    if (!snapshot) {
      return Response.json(
        { success: false, error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: snapshot });
  } catch (error) {
    console.error('Error in GET /api/snapshots/[id]:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch snapshot' },
      { status: 500 }
    );
  }
}
