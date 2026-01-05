/**
 * GET/PUT/DELETE /api/sales/[id]
 * Fetch, update, or delete a single sale
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const result = await query(
      `
      SELECT 
        s.id,
        s.deal_id,
        s.customer_name,
        s.customer_email,
        s.product_service,
        s.quantity,
        s.unit_price,
        s.total_amount,
        s.sale_date,
        s.status,
        s.currency,
        s.notes,
        s.created_at,
        s.updated_at,
        COALESCE(SUM(sp.amount), 0)::DECIMAL as total_paid
      FROM sales s
      LEFT JOIN sales_payments sp ON s.id = sp.sale_id
      WHERE s.id = $1
      GROUP BY s.id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }

    // Get payment history
    const paymentsResult = await query(
      `
      SELECT 
        id,
        amount,
        payment_date,
        payment_method,
        notes,
        created_at,
        updated_at
      FROM sales_payments
      WHERE sale_id = $1
      ORDER BY payment_date DESC
      `,
      [id]
    );

    const sale = result.rows[0];
    return Response.json({
      success: true,
      data: {
        ...sale,
        quantity: parseInt(sale.quantity),
        unit_price: parseFloat(sale.unit_price),
        total_amount: parseFloat(sale.total_amount),
        total_paid: parseFloat(sale.total_paid),
        remaining_balance: parseFloat(sale.total_amount) - parseFloat(sale.total_paid),
        payments: paymentsResult.rows.map(p => ({
          ...p,
          amount: parseFloat(p.amount),
        })),
      },
    });
  } catch (error) {
    console.error('Sale GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      customer_name,
      customer_email,
      product_service,
      quantity,
      unit_price,
      sale_date,
      currency,
      notes,
    } = body;

    // Validate quantity and price if provided
    if (quantity !== undefined && quantity <= 0) {
      return Response.json(
        { success: false, error: 'Quantity must be positive' },
        { status: 400 }
      );
    }

    if (unit_price !== undefined && unit_price < 0) {
      return Response.json(
        { success: false, error: 'Unit price must be non-negative' },
        { status: 400 }
      );
    }

    const result = await query(
      `
      UPDATE sales
      SET 
        customer_name = COALESCE($1, customer_name),
        customer_email = COALESCE($2, customer_email),
        product_service = COALESCE($3, product_service),
        quantity = COALESCE($4, quantity),
        unit_price = COALESCE($5, unit_price),
        sale_date = COALESCE($6, sale_date),
        currency = COALESCE($7, currency),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
      `,
      [
        customer_name || null,
        customer_email || null,
        product_service || null,
        quantity || null,
        unit_price !== undefined ? unit_price : null,
        sale_date || null,
        currency || null,
        notes || null,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }

    const sale = result.rows[0];
    const paymentsResult = await query(
      'SELECT COALESCE(SUM(amount), 0)::DECIMAL as total_paid FROM sales_payments WHERE sale_id = $1',
      [id]
    );
    const totalPaid = parseFloat(paymentsResult.rows[0]?.total_paid || 0);

    return Response.json({
      success: true,
      data: {
        ...sale,
        quantity: parseInt(sale.quantity),
        unit_price: parseFloat(sale.unit_price),
        total_amount: parseFloat(sale.total_amount),
        total_paid: totalPaid,
        remaining_balance: parseFloat(sale.total_amount) - totalPaid,
      },
    });
  } catch (error) {
    console.error('Sale PUT error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const result = await query(
      'DELETE FROM sales WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: 'Sale deleted successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    console.error('Sale DELETE error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
