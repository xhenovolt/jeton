/**
 * GET/PUT /api/prospects/[id]/activities/[activityId]
 * Individual prospect activity management
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id, activityId } = params;

    const result = await query(
      `
      SELECT 
        id,
        prospect_id,
        activity_type,
        title,
        description,
        outcome,
        product_discussed,
        objections_raised,
        objections_handled,
        resolution,
        prospect_mood,
        confidence_level,
        next_action,
        follow_up_date,
        follow_up_type,
        communication_method,
        duration_minutes,
        is_locked,
        locked_at,
        locked_by,
        created_by,
        created_at
      FROM prospect_activities
      WHERE id = $1 AND prospect_id = $2
      `,
      [activityId, id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Activity GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id, activityId } = params;
    const body = await request.json();
    const userId = request.headers.get('x-user-id') || null;

    // Check if activity is locked
    const activityCheck = await query(
      'SELECT is_locked FROM prospect_activities WHERE id = $1 AND prospect_id = $2',
      [activityId, id]
    );

    if (activityCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    if (activityCheck.rows[0].is_locked) {
      return Response.json(
        {
          success: false,
          error: 'Activity is locked and cannot be modified',
        },
        { status: 403 }
      );
    }

    // Build update query dynamically
    const updateableFields = [
      'title',
      'description',
      'outcome',
      'product_discussed',
      'objections_raised',
      'objections_handled',
      'resolution',
      'prospect_mood',
      'confidence_level',
      'next_action',
      'follow_up_date',
      'follow_up_type',
      'communication_method',
      'duration_minutes',
    ];

    const updates = [];
    const params = [];
    let paramIdx = 1;

    updateableFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx}`);
        params.push(body[field]);
        paramIdx++;
      }
    });

    if (updates.length === 0) {
      return Response.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add activity ID and prospect ID to where clause
    params.push(activityId);
    params.push(id);

    const result = await query(
      `
      UPDATE prospect_activities
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx} AND prospect_id = $${paramIdx + 1}
      RETURNING 
        id,
        activity_type,
        title,
        description,
        outcome,
        product_discussed,
        objections_raised,
        objections_handled,
        resolution,
        prospect_mood,
        confidence_level,
        next_action,
        follow_up_date,
        follow_up_type,
        communication_method,
        duration_minutes,
        is_locked,
        created_at
      `,
      params
    );

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Activity PUT error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    // Activities should never be deleted - this endpoint returns an error
    return Response.json(
      {
        success: false,
        error: 'Activities cannot be deleted. This is an append-only system. Lock the activity if it should not be edited.',
      },
      { status: 403 }
    );
  } catch (error) {
    console.error('Activity DELETE error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
