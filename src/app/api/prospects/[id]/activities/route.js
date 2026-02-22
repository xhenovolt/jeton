/**
 * GET/POST /api/prospects/[id]/activities
 * Prospect Activities - Chronological journal of all interactions
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');

    // Verify prospect exists
    const prospectCheck = await query(
      'SELECT id FROM prospects WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (prospectCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Build query
    let where = 'WHERE prospect_id = $1';
    const params = [id];
    let paramIdx = 2;

    if (type) {
      where += ` AND activity_type = $${paramIdx}`;
      params.push(type);
      paramIdx++;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM prospect_activities ${where}`,
      params
    );

    // Get activities (newest first - chronological order)
    const result = await query(
      `
      SELECT 
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
        locked_at,
        created_by,
        created_at
      FROM prospect_activities
      ${where}
      ORDER BY created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Activities GET error:', error);
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
    const userId = request.headers.get('x-user-id') || null;

    const {
      activity_type,
      title,
      description,
      outcome,
      product_discussed,
      objections_raised,
      objections_handled = false,
      resolution,
      prospect_mood,
      confidence_level,
      next_action,
      follow_up_date,
      follow_up_type,
      communication_method,
      duration_minutes,
    } = body;

    // Validation
    if (!activity_type) {
      return Response.json(
        { success: false, error: 'activity_type is required' },
        { status: 400 }
      );
    }

    if (!title) {
      return Response.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }

    // Verify prospect exists
    const prospectCheck = await query(
      'SELECT id FROM prospects WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (prospectCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Create activity
    const result = await query(
      `
      INSERT INTO prospect_activities (
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
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        created_by,
        created_at
      `,
      [
        id,
        activity_type,
        title,
        description || null,
        outcome || null,
        product_discussed || null,
        objections_raised || null,
        objections_handled,
        resolution || null,
        prospect_mood || null,
        confidence_level || null,
        next_action || null,
        follow_up_date || null,
        follow_up_type || null,
        communication_method || null,
        duration_minutes || null,
        userId,
      ]
    );

    return Response.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Activities POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
