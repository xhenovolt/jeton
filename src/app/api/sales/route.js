/**
 * GET/POST /api/sales
 * Fetch all sales (paginated) or create a new sale
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const offset = (page - 1) * limit;

    // Build dynamic query
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (customer_name ILIKE $${paramIndex} OR customer_email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND sale_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND sale_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(`SELECT COUNT(*) as total FROM sales ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated sales
    const result = await query(
      `
      SELECT 
        s.id,
        s.deal_id,
        s.salesperson_id,
        s.customer_name,
        s.customer_email,
        s.amount,
        s.currency,
        s.status,
        s.created_at,
        s.updated_at
      FROM sales s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    const sales = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount),
    }));

    return Response.json({
      success: true,
      data: sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Sales GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      deal_id,
      salesperson_id,
      customer_name,
      customer_email,
      amount,
      currency = 'UGX',
      status = 'Pending',
    } = body;

    // Validation
    if (!customer_name || amount === undefined) {
      return Response.json(
        { success: false, error: 'Missing required fields: customer_name, amount' },
        { status: 400 }
      );
    }

    if (amount < 0) {
      return Response.json(
        { success: false, error: 'Amount must be non-negative' },
        { status: 400 }
      );
    }

    // Get userId from headers if salesperson_id not provided
    const userId = salesperson_id || request.headers.get('x-user-id') || null;

    const result = await query(
      `
      INSERT INTO sales (
        deal_id, salesperson_id, customer_name, customer_email, amount, 
        currency, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        deal_id || null,
        userId,
        customer_name,
        customer_email || null,
        amount,
        currency,
        status,
      ]
    );

    const sale = result.rows[0];
    return Response.json({
      success: true,
      data: {
        ...sale,
        amount: parseFloat(sale.amount),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Sales POST error:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error.message,
        details: error.detail || error.hint
      },
      { status: 500 }
    );
  }
}
