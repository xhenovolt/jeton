/**
 * GET/PUT/DELETE /api/prospects/[id]
 * Prospect CRUD and conversion operations
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const result = await query(
      `
      SELECT 
        p.id,
        p.prospect_name,
        p.phone,
        p.email,
        p.business_name,
        p.address,
        p.industry,
        p.source,
        p.product_discussed,
        p.conversation_notes,
        p.objections,
        p.estimated_budget,
        p.follow_up_date,
        p.sales_stage,
        p.status,
        p.interest_level,
        p.assigned_to,
        p.last_contact_date,
        p.last_activity_id,
        p.next_follow_up_date,
        p.total_activities_count,
        p.converted_deal_id,
        p.conversion_date,
        p.days_in_pipeline,
        p.created_by,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT pa.id) as activity_count,
        COUNT(DISTINCT CASE WHEN pa.activity_type = 'CONVERSATION' THEN pa.id END) as conversation_count,
        COUNT(DISTINCT CASE WHEN pa.outcome = 'positive' THEN pa.id END) as positive_outcomes_count
      FROM prospects p
      LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
      WHERE p.id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Prospect GET error:', error);
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

    // Check if prospect exists
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

    // Build update query dynamically
    const updateableFields = [
      'prospect_name',
      'phone',
      'email',
      'business_name',
      'address',
      'industry',
      'source',
      'product_discussed',
      'conversation_notes',
      'objections',
      'estimated_budget',
      'follow_up_date',
      'sales_stage',
      'status',
      'interest_level',
      'assigned_to',
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

    params.push(id);

    const result = await query(
      `
      UPDATE prospects
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING 
        id,
        prospect_name,
        phone,
        email,
        business_name,
        address,
        industry,
        source,
        product_discussed,
        conversation_notes,
        objections,
        estimated_budget,
        follow_up_date,
        sales_stage,
        status,
        interest_level,
        assigned_to,
        last_contact_date,
        next_follow_up_date,
        total_activities_count,
        converted_deal_id,
        conversion_date,
        days_in_pipeline,
        created_at,
        updated_at
      `,
      params
    );

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Prospect PUT error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Soft delete prospect
    const result = await query(
      `
      UPDATE prospects
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found or already deleted' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: 'Prospect deleted successfully',
    });
  } catch (error) {
    console.error('Prospect DELETE error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
