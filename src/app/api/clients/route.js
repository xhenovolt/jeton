/**
 * GET /api/clients
 * LIST all clients
 *
 * POST /api/clients
 * CREATE new client (typically from prospect conversion)
 */

import { query } from '@/lib/db.js';
import { validateClient } from '@/lib/validation.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;
    const params = [];
    const whereClauses = [];
    let paramIdx = 1;

    if (status) {
      whereClauses.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    if (search) {
      whereClauses.push(`(name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR company_name ILIKE $${paramIdx++})`);
      params.push(`%${search}%`);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count
    const countResult = await query(
      `SELECT COUNT(*) FROM clients ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated clients with prospect info
    const clientsResult = await query(
      `SELECT 
         c.*,
         p.prospect_name as original_prospect_name,
         p.company_name as prospect_company,
         (SELECT COUNT(*) FROM contracts con WHERE con.client_id = c.id) as contract_count,
         (SELECT COALESCE(SUM(pay.amount_received), 0) FROM payments pay 
          JOIN contracts con ON pay.contract_id = con.id 
          WHERE con.client_id = c.id) as total_revenue
       FROM clients c
       LEFT JOIN prospects p ON c.prospect_id = p.id
       ${whereSQL}
       ORDER BY c.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      clients: clientsResult.rows.map(row => ({
        ...row,
        total_revenue: parseFloat(row.total_revenue) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateClient(body);
    if (!validation.success) {
      return Response.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      phone,
      company_name,
      address,
      prospect_id,
      status,
      notes,
    } = validation.data;

    // If prospect_id provided, check it exists and isn't already converted
    if (prospect_id) {
      const prospectCheck = await query(
        'SELECT id, status FROM prospects WHERE id = $1',
        [prospect_id]
      );
      if (prospectCheck.rowCount === 0) {
        return Response.json(
          { success: false, error: 'Prospect not found' },
          { status: 404 }
        );
      }
      if (prospectCheck.rows[0].status === 'converted') {
        // Check if client already exists
        const existingClient = await query(
          'SELECT id FROM clients WHERE prospect_id = $1',
          [prospect_id]
        );
        if (existingClient.rowCount > 0) {
          return Response.json(
            { success: false, error: 'Prospect already converted to client', client_id: existingClient.rows[0].id },
            { status: 409 }
          );
        }
      }
    }

    // Create client
    const result = await query(
      `INSERT INTO clients (name, email, phone, company_name, address, prospect_id, status, notes, converted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING *`,
      [name, email || null, phone || null, company_name || null, address || null, prospect_id || null, status, notes || null]
    );

    const newClient = result.rows[0];

    // Update prospect status to converted if linked
    if (prospect_id) {
      await query(
        `UPDATE prospects SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [prospect_id]
      );
      
      // Log conversion activity
      await query(
        `INSERT INTO prospect_activities (prospect_id, activity_type, subject, description, created_by_id, activity_date)
         VALUES ($1, 'converted', 'Converted to client', $2, NULL, CURRENT_TIMESTAMP)`,
        [prospect_id, `Client created: ${name}`]
      );
    }

    return Response.json(
      { success: true, client: newClient, message: 'Client created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating client:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
