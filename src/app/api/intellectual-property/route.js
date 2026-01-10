/**
 * GET /api/intellectual-property
 * List all intellectual property assets
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        description,
        ip_type,
        development_cost,
        valuation_estimate,
        revenue_generated_lifetime,
        revenue_generated_monthly,
        clients_count,
        monetization_model,
        ownership_percentage,
        status,
        launch_date,
        created_at,
        updated_at
      FROM intellectual_property
      WHERE status IN ('active', 'scaling', 'maintenance')
      ORDER BY created_at DESC
    `);

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('IP GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/intellectual-property
 * Create a new IP asset
 */
export async function POST(request) {
  try {
    // Authenticate user
    const user = await requireApiAuth();
    
    const body = await request.json();

    // Validation
    const required = ['name', 'ip_type', 'development_cost'];
    for (const field of required) {
      if (!body[field]) {
        return Response.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate IP type
    const validTypes = ['software', 'internal_system', 'licensed_ip', 'brand', 'other'];
    if (!validTypes.includes(body.ip_type)) {
      return Response.json(
        { success: false, error: `Invalid IP type: ${body.ip_type}` },
        { status: 400 }
      );
    }

    // Validate development cost
    const devCost = parseFloat(body.development_cost);
    if (isNaN(devCost) || devCost < 0) {
      return Response.json(
        { success: false, error: 'Development cost must be a positive number' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const dupCheck = await query(
      'SELECT id FROM intellectual_property WHERE name = $1',
      [body.name]
    );
    if (dupCheck.rowCount > 0) {
      return Response.json(
        { success: false, error: 'IP with this name already exists' },
        { status: 409 }
      );
    }

    const result = await query(
      `
      INSERT INTO intellectual_property (
        name,
        description,
        ip_type,
        ip_subtype,
        development_cost,
        development_start_date,
        development_completion_date,
        valuation_estimate,
        valuation_basis,
        revenue_generated_lifetime,
        revenue_generated_monthly,
        clients_count,
        monetization_model,
        ownership_percentage,
        owner_name,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
      `,
      [
        body.name,
        body.description || null,
        body.ip_type,
        body.ip_subtype || null,
        devCost,
        body.development_start_date || null,
        body.development_completion_date || null,
        body.valuation_estimate ? parseFloat(body.valuation_estimate) : devCost,
        body.valuation_basis || 'cost',
        body.revenue_generated_lifetime ? parseFloat(body.revenue_generated_lifetime) : 0,
        body.revenue_generated_monthly ? parseFloat(body.revenue_generated_monthly) : 0,
        body.clients_count || 0,
        body.monetization_model || 'license',
        body.ownership_percentage ? parseFloat(body.ownership_percentage) : 100,
        body.owner_name || null,
        'active',
      ]
    );

    return Response.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('IP POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
