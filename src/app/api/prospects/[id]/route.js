/**
 * GET /api/prospects/[id]
 * PUT /api/prospects/[id]
 * Individual prospect operations - OOP implementation
 */

import { getProspectById, updateProspect, getProspectActivities } from '@/lib/prospects.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const prospect = await getProspectById(id);
    if (!prospect) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Get prospect activities
    const activities = await getProspectActivities(id);

    return Response.json({
      success: true,
      data: {
        prospect: prospect.toJSON(),
        activities: activities.map(a => a.toJSON()),
        activity_count: activities.length,
      },
    });
  } catch (error) {
    console.error('GET /api/prospects/[id] error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const prospect = await updateProspect(id, body);

    return Response.json({
      success: true,
      message: 'Prospect updated successfully',
      data: prospect.toJSON(),
    });
  } catch (error) {
    console.error('PUT /api/prospects/[id] error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
