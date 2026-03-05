/**
 * GET /api/clients
 * LIST all clients
 *
 * POST /api/clients
 * CREATE new client
 */

import { query } from '@/lib/db.js';

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
      whereClauses.push(`(name ILIKE $${paramIdx} OR email ILIKE $${paramIdx++})`);
      params.push(`%${search}%`);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count
    const countResult = await query(
      `SELECT COUNT(*) FROM clients ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated clients
    const clientsResult = await query(
      `SELECT * FROM clients
       ${whereSQL}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      clients: clientsResult.rows,
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
    const {
      name,
      email = null,
      phone = null,
      address = null,
      business_name = null,
      status = 'active',
    } = body;

    if (!name) {
      return Response.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO clients (name, email, phone, address, business_name, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone, address, business_name, status]
    );

    return Response.json(
      { success: true, client: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating client:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
