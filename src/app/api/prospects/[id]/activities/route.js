/**
 * GET /api/prospects/[id]/activities
 * POST /api/prospects/[id]/activities
 * 
 * Prospect activity logging and retrieval
 * Activity feeds: call, email, meeting, note, outcome
 * New system uses prospect_activities table with next_followup_date tracking
 */

import { query } from '@/lib/db.js';

/**
 * GET - Retrieve all activities for a prospect
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Validate prospect exists
    const prospectCheck = await query(
      'SELECT id FROM prospects WHERE id = $1',
      [id]
    );

    if (prospectCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Get all activities
    const activities = await query(
      `SELECT 
        id, prospect_id, activity_type, description, outcome, 
        next_followup_date, created_by, created_at, updated_at
       FROM prospect_activities
       WHERE prospect_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return Response.json({
      success: true,
      data: activities.rows || [],
      count: activities.rows?.length || 0,
    });
  } catch (error) {
    console.error('GET /api/prospects/[id]/activities error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Log a new activity for a prospect
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Validate prospect exists
    const prospectCheck = await query(
      'SELECT id FROM prospects WHERE id = $1',
      [id]
    );

    if (prospectCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!body.activity_type) {
      return Response.json(
        { success: false, error: 'activity_type is required (call|email|meeting|note|outcome)' },
        { status: 400 }
      );
    }

    if (!['call', 'email', 'meeting', 'note', 'outcome'].includes(body.activity_type)) {
      return Response.json(
        { success: false, error: 'Invalid activity_type' },
        { status: 400 }
      );
    }

    if (!body.description) {
      return Response.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      );
    }

    // Validate next_followup_date format if provided and is_outcome
    let nextFollowupDate = body.next_followup_date || null;
    if (nextFollowupDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextFollowupDate)) {
      return Response.json(
        { success: false, error: 'next_followup_date must be YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const activityData = {
      activity_type: body.activity_type,
      description: body.description,
      outcome: body.outcome || null,
      next_followup_date: nextFollowupDate,
    };

    // Insert activity
    const activityResult = await query(
      `INSERT INTO prospect_activities (prospect_id, activity_type, description, outcome, next_followup_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, activityData.activity_type, activityData.description, activityData.outcome, activityData.next_followup_date, body.created_by || null]
    );

    const activity = activityResult.rows[0];

    // If this is an outcome activity, also update prospect's follow_up_date
    if (body.activity_type === 'outcome' && nextFollowupDate) {
      await query(
        'UPDATE prospects SET follow_up_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [nextFollowupDate, id]
      );
    }

    return Response.json({
      success: true,
      message: 'Activity logged successfully',
      data: activity,
    });
  } catch (error) {
    console.error('POST /api/prospects/[id]/activities error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
