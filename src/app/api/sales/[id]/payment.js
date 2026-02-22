/**
 * POST /api/sales/[id]/payment
 * Adds payment against unified revenue record and syncs sales/deal state.
 */

import { query } from '@/lib/db.js';
import { ensureRevenueRecordsTable } from '@/lib/revenue.js';

async function resolveRevenue(id) {
  const result = await query(
    `SELECT * FROM revenue_records WHERE id = $1 OR sale_id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

function deriveStatuses(total, paid, dueDate, onCredit, currentStage) {
  const outstanding = Math.max(total - paid, 0);

  let paymentStatus = 'Unpaid';
  if (outstanding <= 0 && total > 0) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Partially Paid';
  else if (onCredit) paymentStatus = 'Credit';

  if (paymentStatus === 'Credit' && dueDate && new Date(dueDate) < new Date()) {
    paymentStatus = 'Overdue';
  }

  let status = 'open';
  if (currentStage === 'Lost') status = 'lost';
  else if (paymentStatus === 'Paid') status = 'paid';
  else if (paymentStatus === 'Partially Paid') status = 'partially_paid';
  else if (paymentStatus === 'Credit' || paymentStatus === 'Overdue') status = 'credit';
  else if (currentStage === 'Won') status = 'won';

  return { paymentStatus, status, outstanding };
}

export async function POST(request, { params }) {
  try {
    // guarantee revenue_records table exists
    await ensureRevenueRecordsTable();
    const { id } = params;
    const body = await request.json();
    const { amount, payment_date, payment_method, notes } = body;

    if (!amount || amount <= 0) {
      return Response.json({ success: false, error: 'Payment amount must be positive' }, { status: 400 });
    }

    const revenue = await resolveRevenue(id);
    if (!revenue) {
      return Response.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    const currentPaidResult = await query(
      'SELECT COALESCE(SUM(amount), 0)::DECIMAL as total_paid FROM revenue_payments WHERE revenue_id = $1',
      [revenue.id]
    );

    const currentPaid = parseFloat(currentPaidResult.rows[0]?.total_paid || 0);
    const totalAmount = parseFloat(revenue.amount_total || 0);

    if (currentPaid + Number(amount) > totalAmount) {
      return Response.json(
        {
          success: false,
          error: `Payment cannot exceed remaining balance of ${Math.max(totalAmount - currentPaid, 0)}`,
        },
        { status: 400 }
      );
    }

    const insertPayment = await query(
      `
      INSERT INTO revenue_payments (revenue_id, sale_id, amount, payment_date, payment_method, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        revenue.id,
        revenue.sale_id || null,
        Number(amount),
        payment_date || new Date().toISOString(),
        payment_method || 'Other',
        notes || null,
      ]
    );

    const refreshedPaidResult = await query(
      'SELECT COALESCE(SUM(amount), 0)::DECIMAL as total_paid FROM revenue_payments WHERE revenue_id = $1',
      [revenue.id]
    );
    const totalPaid = parseFloat(refreshedPaidResult.rows[0]?.total_paid || 0);

    const { paymentStatus, status, outstanding } = deriveStatuses(
      totalAmount,
      totalPaid,
      revenue.due_date,
      revenue.on_credit,
      revenue.stage
    );

    const updatedRevenueResult = await query(
      `
      UPDATE revenue_records
      SET amount_received = $1,
          amount_outstanding = $2,
          payment_status = $3,
          status = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
      `,
      [totalPaid, outstanding, paymentStatus, status, revenue.id]
    );

    const updatedRevenue = updatedRevenueResult.rows[0];

    if (updatedRevenue.sale_id) {
      await query(
        `
        UPDATE sales
        SET total_paid = $1,
            remaining_balance = $2,
            payment_status = $3,
            status = CASE WHEN $3 = 'Paid' THEN 'Paid' WHEN $3 = 'Partially Paid' THEN 'Partially Paid' ELSE 'Pending' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        `,
        [updatedRevenue.amount_received, updatedRevenue.amount_outstanding, updatedRevenue.payment_status, updatedRevenue.sale_id]
      );

      // Legacy mirror for compatibility
      await query(
        `
        INSERT INTO sales_payments (sale_id, amount, payment_date, payment_method, notes)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          updatedRevenue.sale_id,
          Number(amount),
          payment_date || new Date().toISOString(),
          payment_method || 'Other',
          notes || null,
        ]
      );
    }

    if (updatedRevenue.deal_id) {
      await query(
        'UPDATE deals SET stage = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [updatedRevenue.status === 'paid' || updatedRevenue.status === 'partially_paid' || updatedRevenue.status === 'credit' ? 'Won' : 'Negotiation', updatedRevenue.deal_id]
      );
    }

    return Response.json({
      success: true,
      data: {
        payment: {
          ...insertPayment.rows[0],
          amount: parseFloat(insertPayment.rows[0].amount || 0),
        },
        sale: {
          id: updatedRevenue.id,
          sale_id: updatedRevenue.sale_id,
          customer_name: updatedRevenue.customer_name,
          product_service: updatedRevenue.title,
          total_amount: parseFloat(updatedRevenue.amount_total || 0),
          status: updatedRevenue.status,
          payment_status: updatedRevenue.payment_status,
          total_paid: parseFloat(updatedRevenue.amount_received || 0),
          remaining_balance: parseFloat(updatedRevenue.amount_outstanding || 0),
        },
      },
    });
  } catch (error) {
    console.error('Payment POST error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
