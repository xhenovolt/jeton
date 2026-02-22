/**
 * POST /api/prospects/[id]/convert
 * 1-click conversion: prospect -> deal (using database function)
 * This is the new Sales Intelligence System approach
 */

import { query } from '@/lib/db.js';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const userId = request.headers.get('x-user-id') || null;

    const {
      product_service,
      deal_title,
      value_estimate,
    } = body;

    // Validation
    if (!product_service) {
      return Response.json(
        { success: false, error: 'product_service is required' },
        { status: 400 }
      );
    }

    // Get prospect details
    const prospectResult = await query(
      'SELECT prospect_name, email, estimated_budget, created_by FROM prospects WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (prospectResult.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    const prospect = prospectResult.rows[0];

    // Check if already converted
    const checkConverted = await query(
      'SELECT converted_deal_id FROM prospects WHERE id = $1',
      [id]
    );

    if (checkConverted.rows[0].converted_deal_id) {
      return Response.json(
        {
          success: false,
          error: 'Prospect already converted to a deal',
          dealId: checkConverted.rows[0].converted_deal_id,
        },
        { status: 409 }
      );
    }

    // Use the stored procedure to convert
    const conversionResult = await query(
      `
      SELECT * FROM convert_prospect_to_deal($1, $2, $3, $4, $5)
      `,
      [
        id,
        product_service,
        deal_title || `${prospect.prospect_name} - ${product_service}`,
        value_estimate || prospect.estimated_budget || 0,
        userId || prospect.created_by,
      ]
    );

    const { deal_id, success, message } = conversionResult.rows[0];

    if (!success) {
      return Response.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: true,
        message: 'Prospect successfully converted to deal',
        dealId: deal_id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Prospect conversion error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
