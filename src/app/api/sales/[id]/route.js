/**
 * GET/PUT/DELETE /api/sales/[id]
 * Operates on unified revenue_records (SSOT)
 */

import { query } from '@/lib/db.js';
import { ensureRevenueRecordsTable } from '@/lib/revenue.js';

function normalizeStatus(stage, paymentStatus) {
  if (stage === 'Lost') return 'lost';
  if (paymentStatus === 'Paid') return 'paid';
  if (paymentStatus === 'Partially Paid') return 'partially_paid';
  if (paymentStatus === 'Credit' || paymentStatus === 'Overdue') return 'credit';
  if (stage === 'Won') return 'won';
  return 'open';
}

async function resolveRevenueByAnyId(id) {
  const result = await query(
    `
    SELECT rr.*
    FROM revenue_records rr
    WHERE rr.id = $1 OR rr.sale_id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function GET(request, { params }) {
  try {
    await ensureRevenueRecordsTable();
    const { id } = params;
    const revenue = await resolveRevenueByAnyId(id);

    if (!revenue) {
      return Response.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    const paymentsResult = await query(
      `
      SELECT id, amount, payment_date, payment_method, notes, created_at, updated_at
      FROM revenue_payments
      WHERE revenue_id = $1
      ORDER BY payment_date DESC
      `,
      [revenue.id]
    );

    return Response.json({
      success: true,
      data: {
        id: revenue.id,
        revenue_id: revenue.id,
        sale_id: revenue.sale_id,
        deal_id: revenue.deal_id,
        customer_name: revenue.customer_name,
        customer_email: revenue.customer_email,
        product_service: revenue.title,
        amount: parseFloat(revenue.amount_total || 0),
        total_amount: parseFloat(revenue.amount_total || 0),
        total_paid: parseFloat(revenue.amount_received || 0),
        remaining_balance: parseFloat(revenue.amount_outstanding || 0),
        payment_status: revenue.payment_status,
        status: revenue.status,
        due_date: revenue.due_date,
        on_credit: revenue.on_credit,
        sale_date: revenue.created_at,
        created_at: revenue.created_at,
        updated_at: revenue.updated_at,
        payments: paymentsResult.rows.map((p) => ({
          ...p,
          amount: parseFloat(p.amount || 0),
        })),
      },
    });
  } catch (error) {
    console.error('Sale GET error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureRevenueRecordsTable();
    const { id } = params;
    const body = await request.json();

    const revenue = await resolveRevenueByAnyId(id);
    if (!revenue) {
      return Response.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    const customerName = body.customer_name ?? revenue.customer_name;
    const customerEmail = body.customer_email ?? revenue.customer_email;
    const productService = body.product_service ?? revenue.title;
    const amountTotal = body.amount !== undefined || body.total_amount !== undefined
      ? Number(body.total_amount ?? body.amount)
      : Number(revenue.amount_total || 0);

    if (!customerName) {
      return Response.json({ success: false, error: 'customer_name is required' }, { status: 400 });
    }

    if (!Number.isFinite(amountTotal) || amountTotal < 0) {
      return Response.json({ success: false, error: 'Amount must be non-negative' }, { status: 400 });
    }

    const paymentStatus = body.payment_status || revenue.payment_status;
    const stage = body.stage || revenue.stage || 'Won';
    const status = body.status || normalizeStatus(stage, paymentStatus);

    const updateResult = await query(
      `
      UPDATE revenue_records
      SET customer_name = $1,
          customer_email = $2,
          title = $3,
          amount_total = $4,
          amount_outstanding = GREATEST($4 - amount_received, 0),
          payment_status = $5,
          status = $6,
          due_date = COALESCE($7, due_date),
          stage = COALESCE($8, stage),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
      `,
      [
        customerName,
        customerEmail || null,
        productService,
        amountTotal,
        paymentStatus,
        status,
        body.due_date || null,
        stage,
        revenue.id,
      ]
    );

    const updated = updateResult.rows[0];

    if (updated.sale_id) {
      await query(
        `
        UPDATE sales
        SET customer_name = $1,
            customer_email = $2,
            product_service = $3,
            amount = $4,
            total_amount = $4,
            total_paid = $5,
            remaining_balance = $6,
            payment_status = $7,
            status = CASE WHEN $7 = 'Paid' THEN 'Paid' WHEN $7 = 'Partially Paid' THEN 'Partially Paid' ELSE 'Pending' END,
            due_date = COALESCE($8, due_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        `,
        [
          updated.customer_name,
          updated.customer_email,
          updated.title,
          updated.amount_total,
          updated.amount_received,
          updated.amount_outstanding,
          updated.payment_status,
          updated.due_date,
          updated.sale_id,
        ]
      );
    }

    if (updated.deal_id) {
      const dealStage = updated.status === 'lost' ? 'Lost' : updated.status === 'open' ? 'Negotiation' : 'Won';
      await query('UPDATE deals SET stage = $1, client_name = $2, value_estimate = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', [dealStage, updated.customer_name, updated.amount_total, updated.deal_id]);
    }

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        revenue_id: updated.id,
        sale_id: updated.sale_id,
        deal_id: updated.deal_id,
        customer_name: updated.customer_name,
        customer_email: updated.customer_email,
        product_service: updated.title,
        amount: parseFloat(updated.amount_total || 0),
        total_amount: parseFloat(updated.amount_total || 0),
        total_paid: parseFloat(updated.amount_received || 0),
        remaining_balance: parseFloat(updated.amount_outstanding || 0),
        payment_status: updated.payment_status,
        status: updated.status,
        due_date: updated.due_date,
      },
    });
  } catch (error) {
    console.error('Sale PUT error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureRevenueRecordsTable();
    const { id } = params;
    const revenue = await resolveRevenueByAnyId(id);

    if (!revenue) {
      return Response.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    await query('DELETE FROM revenue_records WHERE id = $1', [revenue.id]);

    if (revenue.sale_id) {
      await query('DELETE FROM sales WHERE id = $1', [revenue.sale_id]);
    }

    if (revenue.deal_id) {
      await query('UPDATE deals SET stage = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stage = $3', ['Negotiation', revenue.deal_id, 'Won']);
    }

    return Response.json({
      success: true,
      message: 'Sale deleted successfully',
      data: { id: revenue.id },
    });
  } catch (error) {
    console.error('Sale DELETE error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
