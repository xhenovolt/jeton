/**
 * POST /api/prospects/[id]/convert-to-client
 *
 * Convert a prospect into a client
 * This is distinct from converting to deal - it creates a client record
 * and links the prospect to it for contract creation flow
 *
 * Only allow conversion if prospect is not already a client
 */

import { query } from '@/lib/db.js';

export async function POST(request, { params }) {
  try {
    const prospectId = params.id;
    const body = await request.json();

    // Get prospect
    const prospectResult = await query(
      'SELECT * FROM prospects WHERE id = $1',
      [prospectId]
    );

    if (prospectResult.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    const prospect = prospectResult.rows[0];

    // Validate conversion eligibility
    if (prospect.client_id) {
      return Response.json(
        {
          success: false,
          error: `Prospect already converted. Client ID: ${prospect.client_id}`,
        },
        { status: 400 }
      );
    }

    // Create client record from prospect data
    // Use provided name or prospect name as fallback
    const clientData = {
      name: body.name || prospect.prospect_name,
      email: body.email || prospect.email,
      phone: body.phone || prospect.phone,
      business_name: body.business_name || prospect.business_name,
      address: body.address || prospect.address || null,
    };

    // Validate name is provided
    if (!clientData.name) {
      return Response.json(
        { success: false, error: 'Client name is required' },
        { status: 400 }
      );
    }

    // Insert client
    const clientResult = await query(
      `INSERT INTO clients (name, email, phone, business_name, address, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [clientData.name, clientData.email, clientData.phone, clientData.business_name, clientData.address]
    );

    const client = clientResult.rows[0];

    // Link prospect to client
    const updateResult = await query(
      `UPDATE prospects 
       SET client_id = $1, sales_stage = 'Converted', status = 'Converted', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING *`,
      [client.id, prospectId]
    );

    const updatedProspect = updateResult.rows[0];

    // Log conversion as activity
    await query(
      `INSERT INTO prospect_activities (prospect_id, activity_type, description, outcome, created_by, created_at, updated_at)
       VALUES ($1, 'outcome', $2, 'converted', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [prospectId, `Converted to client: ${client.name}`, body.converted_by || null]
    );

    return Response.json({
      success: true,
      message: `✓ Converted ${prospect.prospect_name} to client: ${client.name}`,
      prospect: updatedProspect,
      client: client,
    });
  } catch (error) {
    console.error('Error converting prospect to client:', error);
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to convert prospect to client',
      },
      { status: 500 }
    );
  }
}
