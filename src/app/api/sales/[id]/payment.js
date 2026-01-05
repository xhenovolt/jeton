/**
 * POST /api/sales/[id]/payment
 * Add a payment to a sale and auto-update status
 */

import { query } from '@/lib/db.js';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { amount, payment_date, payment_method, notes } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return Response.json(
        { success: false, error: 'Payment amount must be positive' },
        { status: 400 }
      );
    }

    // Verify sale exists
    const saleResult = await query('SELECT id, total_amount FROM sales WHERE id = $1', [id]);
    if (saleResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }

    const saleTotal = parseFloat(saleResult.rows[0].total_amount);

    // Get current total paid
    const paidResult = await query(
      'SELECT COALESCE(SUM(amount), 0)::DECIMAL as total_paid FROM sales_payments WHERE sale_id = $1',
      [id]
    );
    const currentPaid = parseFloat(paidResult.rows[0].total_paid);

    // Check if payment would exceed total
    if (currentPaid + amount > saleTotal) {
      return Response.json(
        { success: false, error: `Payment cannot exceed remaining balance of ${saleTotal - currentPaid}` },
        { status: 400 }
      );
    }

    // Insert payment
    const result = await query(
      `
      INSERT INTO sales_payments (sale_id, amount, payment_date, payment_method, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        sale_id,
        amount,
        payment_date,
        payment_method,
        notes,
        created_at,
        updated_at
      `,
      [
        id,
        amount,
        payment_date || new Date().toISOString(),
        payment_method || 'Other',
        notes || null,
      ]
    );

    const payment = result.rows[0];

    // Fetch updated sale with new status
    const updatedSaleResult = await query(
      `
      SELECT 
        id,
        customer_name,
        product_service,
        quantity,
        unit_price,
        total_amount,
        status,
        COALESCE(SUM(sp.amount), 0)::DECIMAL as total_paid
      FROM sales s
      LEFT JOIN sales_payments sp ON s.id = sp.sale_id
      WHERE s.id = $1
      GROUP BY s.id
      `,
      [id]
    );

    const updatedSale = updatedSaleResult.rows[0];

    return Response.json({
      success: true,
      data: {
        payment: {
          ...payment,
          amount: parseFloat(payment.amount),
        },
        sale: {
          id: updatedSale.id,
          customer_name: updatedSale.customer_name,
          product_service: updatedSale.product_service,
          quantity: parseInt(updatedSale.quantity),
          unit_price: parseFloat(updatedSale.unit_price),
          total_amount: parseFloat(updatedSale.total_amount),
          status: updatedSale.status,
          total_paid: parseFloat(updatedSale.total_paid),
          remaining_balance: parseFloat(updatedSale.total_amount) - parseFloat(updatedSale.total_paid),
        },
      },
    });
  } catch (error) {
    console.error('Payment POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
