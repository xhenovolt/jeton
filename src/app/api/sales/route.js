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
        s.customer_name,
        s.customer_email,
        s.quantity,
        s.unit_price,
        s.total_amount,
        s.sale_date,
        s.status,
        s.currency,
        s.notes,
        s.created_at,
        s.updated_at
      FROM sales s
      ${whereClause}
      ORDER BY s.sale_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    const sales = result.rows.map(row => ({
      ...row,
      quantity: parseInt(row.quantity),
      unit_price: parseFloat(row.unit_price),
      total_amount: parseFloat(row.total_amount),
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
      customer_name,
      customer_email,
      product_service,
      quantity,
      unit_price,
      sale_date,
      currency,
      notes,
    } = body;

    // Validation
    if (!customer_name || !product_service || !quantity || unit_price === undefined) {
      return Response.json(
        { success: false, error: 'Missing required fields: customer_name, product_service, quantity, unit_price' },
        { status: 400 }
      );
    }

    if (quantity <= 0 || unit_price < 0) {
      return Response.json(
        { success: false, error: 'Quantity must be positive and unit_price must be non-negative' },
        { status: 400 }
      );
    }

    const result = await query(
      `
      INSERT INTO sales (
        deal_id, customer_name, customer_email, product_service, quantity, 
        unit_price, sale_date, currency, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        deal_id || null,
        customer_name,
        customer_email || null,
        product_service,
        quantity,
        unit_price,
        sale_date || new Date().toISOString(),
        currency || 'UGX',
        notes || null,
      ]
    );

    const sale = result.rows[0];
    return Response.json({
      success: true,
      data: {
        ...sale,
        quantity: parseInt(sale.quantity),
        unit_price: parseFloat(sale.unit_price),
        total_amount: parseFloat(sale.total_amount),
        total_paid: 0,
        remaining_balance: parseFloat(sale.total_amount),
      },
    });
  } catch (error) {
    console.error('Sales POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
