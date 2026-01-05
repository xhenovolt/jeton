/**
 * GET /api/assets-accounting
 * List all tangible depreciable assets
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        description,
        asset_type,
        acquisition_cost,
        acquisition_date,
        depreciation_method,
        depreciation_rate,
        accumulated_depreciation,
        current_book_value,
        location,
        owner_name,
        status,
        created_at,
        updated_at
      FROM assets_accounting
      WHERE status != 'disposed'
      ORDER BY created_at DESC
    `);

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Assets GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assets-accounting
 * Create a new tangible asset
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Validation
    const required = ['name', 'asset_type', 'acquisition_cost', 'acquisition_date'];
    for (const field of required) {
      if (!body[field]) {
        return Response.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate asset type
    const validTypes = ['laptop', 'phone', 'equipment', 'furniture', 'other'];
    if (!validTypes.includes(body.asset_type)) {
      return Response.json(
        { success: false, error: `Invalid asset type: ${body.asset_type}` },
        { status: 400 }
      );
    }

    // Validate numeric values
    const cost = parseFloat(body.acquisition_cost);
    if (isNaN(cost) || cost < 0) {
      return Response.json(
        { success: false, error: 'Acquisition cost must be a positive number' },
        { status: 400 }
      );
    }

    const result = await query(
      `
      INSERT INTO assets_accounting (
        name,
        description,
        asset_type,
        asset_subtype,
        acquisition_cost,
        acquisition_date,
        depreciation_method,
        depreciation_rate,
        residual_value,
        location,
        owner_name,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        body.name,
        body.description || null,
        body.asset_type,
        body.asset_subtype || null,
        cost,
        body.acquisition_date,
        body.depreciation_method || 'straight_line',
        parseFloat(body.depreciation_rate || 20),
        body.residual_value ? parseFloat(body.residual_value) : null,
        body.location || null,
        body.owner_name || null,
        'active',
      ]
    );

    return Response.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Assets POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
