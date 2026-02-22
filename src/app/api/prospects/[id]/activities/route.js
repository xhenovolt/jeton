/**
 * GET /api/prospects/[id]/activities
 * POST /api/prospects/[id]/activities
 * Prospect activity logging and retrieval
 */

import { logActivity, getProspectActivities } from '@/lib/prospects.js';
import { requireApiAuth } from '@/lib/api-auth.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const activities = await getProspectActivities(id);

    return Response.json({
      success: true,
      data: activities.map(a => a.toJSON()),
      count: activities.length,
    });
  } catch (error) {
    console.error('GET /api/prospects/[id]/activities error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Get current user - throws 401 if not authenticated
    const user = await requireApiAuth();

    // Validate required fields
    if (!body.activity_type) {
      return Response.json(
        { success: false, error: 'activity_type is required' },
        { status: 400 }
      );
    }

    const activityData = {
      activity_type: body.activity_type,
      subject: body.subject || null,
      description: body.description || null,
      outcome: body.outcome || null,
      notes: body.notes || null,
      products_discussed: body.products_discussed || null,
      objections: body.objections || null,
      feedback: body.feedback || null,
      activity_date: body.activity_date || new Date(),
      duration_minutes: body.duration_minutes || null,
    };

    const activity = await logActivity(id, activityData, user.userId);

    return Response.json({
      success: true,
      message: 'Activity logged successfully',
      data: activity.toJSON(),
    });
  } catch (error) {
    console.error('POST /api/prospects/[id]/activities error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
