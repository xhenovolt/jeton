/**
 * GET /api/infrastructure
 * List all infrastructure assets
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        description,
        infrastructure_type,
        owner_name,
        access_level,
        risk_level,
        replacement_cost,
        domain_name,
        platform,
        social_handle,
        status,
        created_at,
        updated_at
      FROM infrastructure
      WHERE status IN ('active')
      ORDER BY risk_level DESC, created_at DESC
    `);

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('[API] GET /api/infrastructure - ERROR:', {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack?.split('\n')[0],
    });
    
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/infrastructure
 * Create a new infrastructure asset
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Validation
    const required = ['name', 'infrastructure_type'];
    for (const field of required) {
      if (!body[field]) {
        return Response.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate infrastructure type
    const validTypes = ['brand', 'website', 'domain', 'social_media', 'design_system', 'other'];
    if (!validTypes.includes(body.infrastructure_type)) {
      return Response.json(
        { success: false, error: `Invalid infrastructure type: ${body.infrastructure_type}` },
        { status: 400 }
      );
    }

    // Validate replacement cost if provided
    if (body.replacement_cost) {
      const cost = parseFloat(body.replacement_cost);
      if (isNaN(cost) || cost < 0) {
        return Response.json(
          { success: false, error: 'Replacement cost must be a positive number' },
          { status: 400 }
        );
      }
    }

    const result = await query(
      `
      INSERT INTO infrastructure (
        name,
        description,
        infrastructure_type,
        owner_name,
        access_level,
        risk_level,
        replacement_cost,
        domain_name,
        domain_registrar,
        domain_expiry_date,
        platform,
        social_handle,
        social_recovery_email,
        social_recovery_phone,
        file_location,
        version,
        status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
      `,
      [
        body.name,
        body.description || null,
        body.infrastructure_type,
        body.owner_name || null,
        body.access_level || 'limited',
        body.risk_level || 'medium',
        body.replacement_cost ? parseFloat(body.replacement_cost) : null,
        body.domain_name || null,
        body.domain_registrar || null,
        body.domain_expiry_date || null,
        body.platform || null,
        body.social_handle || null,
        body.social_recovery_email || null,
        body.social_recovery_phone || null,
        body.file_location || null,
        body.version || null,
        'active',
        body.notes || null,
      ]
    );

    return Response.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] POST /api/infrastructure - ERROR:', {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack?.split('\n')[0],
    });
    
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
