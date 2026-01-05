/**
 * POST /api/deals/[id]/convert-to-sale
 * Manually trigger sales creation from a Won deal
 * Also handles checking if sale already exists
 */

import { query } from '@/lib/db.js';

export async function POST(request, { params }) {
  try {
    const { id } = params;

    // Get the deal details
    const dealResult = await query(
      `SELECT 
        id, 
        title, 
        client_name, 
        value_estimate, 
        stage 
      FROM deals 
      WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (dealResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    const deal = dealResult.rows[0];

    // Check if already won
    if (deal.stage !== 'Won') {
      return Response.json(
        { success: false, error: `Deal must be marked as "Won" to create a sale. Current stage: ${deal.stage}` },
        { status: 400 }
      );
    }

    // Check if sale already exists for this deal
    const existingSaleResult = await query(
      'SELECT id FROM sales WHERE deal_id = $1 LIMIT 1',
      [id]
    );

    if (existingSaleResult.rowCount > 0) {
      return Response.json(
        { success: true, message: 'Sale already exists for this deal', data: { sale_id: existingSaleResult.rows[0].id } },
        { status: 200 }
      );
    }

    // Create the sale
    const createSaleResult = await query(
      `INSERT INTO sales (
        deal_id,
        customer_name,
        product_service,
        quantity,
        unit_price,
        sale_date,
        status,
        currency,
        notes,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, deal_id, customer_name, total_amount, status`,
      [
        deal.id,
        deal.client_name || 'Unknown Customer',
        deal.title,
        1,
        Math.max(0, parseFloat(deal.value_estimate) || 0),
        'Pending',
        'UGX',
        `Created from won deal #${deal.id}`,
      ]
    );

    if (createSaleResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Failed to create sale' },
        { status: 500 }
      );
    }

    const sale = createSaleResult.rows[0];

    return Response.json({
      success: true,
      message: 'Sale created successfully from Won deal',
      data: {
        sale_id: sale.id,
        deal_id: sale.deal_id,
        customer_name: sale.customer_name,
        total_amount: parseFloat(sale.total_amount),
        status: sale.status,
      },
    });
  } catch (error) {
    console.error('Convert to sale error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Get deal and check for linked sale
    const result = await query(
      `SELECT 
        d.id,
        d.title,
        d.stage,
        d.value_estimate,
        s.id as sale_id,
        s.status as sale_status,
        s.total_amount as sale_amount
      FROM deals d
      LEFT JOIN sales s ON d.id = s.deal_id
      WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    return Response.json({
      success: true,
      data: {
        deal_id: row.id,
        deal_title: row.title,
        deal_stage: row.stage,
        deal_value: parseFloat(row.value_estimate),
        sale_id: row.sale_id,
        sale_status: row.sale_status,
        sale_amount: row.sale_amount ? parseFloat(row.sale_amount) : null,
        has_sale: row.sale_id !== null,
      },
    });
  } catch (error) {
    console.error('Get deal sale info error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
