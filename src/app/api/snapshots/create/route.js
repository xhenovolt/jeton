import { createSnapshot } from '@/lib/reports';

/**
 * POST /api/snapshots/create
 * Create a new financial snapshot
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { type = 'MANUAL' } = body;

    const validTypes = ['NET_WORTH', 'PIPELINE_VALUE', 'FINANCIAL_SUMMARY', 'MANUAL'];
    if (!validTypes.includes(type)) {
      return Response.json(
        { success: false, error: 'Invalid snapshot type' },
        { status: 400 }
      );
    }

    // Get userId from headers or session (optional for now since created_by is nullable)
    const userId = request.headers.get('x-user-id') || null;

    const snapshot = await createSnapshot(type, userId);

    return Response.json(
      { success: true, data: snapshot, message: 'Snapshot created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/snapshots/create:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to create snapshot',
        message: error.message,
        details: error.detail || error.hint
      },
      { status: 500 }
    );
  }
}
