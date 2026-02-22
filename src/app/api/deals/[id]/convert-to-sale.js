/**
 * POST /api/deals/[id]/convert-to-sale
 * Converts deal -> sale using unified revenue SSOT.
 */

import { query } from '@/lib/db.js';
import { ensureRevenueRecordsTable } from '@/lib/revenue.js';

export async function POST(request, { params }) {
  try {
    // make sure revenue_records table exists before trying to insert
    await ensureRevenueRecordsTable();
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { upfront_amount = 0, due_date = null, notes = '' } = body || {};

    const dealResult = await query(
      `
      SELECT id, title, client_name, value_estimate, probability, stage, expected_close_date
      FROM deals
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [id]
    );

    if (dealResult.rowCount === 0) {
      return Response.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }

    const deal = dealResult.rows[0];

    if (deal.stage !== 'Won') {
      await query('UPDATE deals SET stage = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['Won', id]);
    }

    const totalAmount = Math.max(0, parseFloat(deal.value_estimate || 0));
    const paid = Math.max(0, Math.min(totalAmount, parseFloat(upfront_amount || 0)));
    const outstanding = Math.max(totalAmount - paid, 0);

    const resolvedDueDate = due_date || deal.expected_close_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const paymentStatus = outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Credit';
    const status = outstanding <= 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'credit';

    const revenueResult = await query(
      `
      INSERT INTO revenue_records (
        deal_id, type, status, stage, title, customer_name, amount_total,
        amount_received, amount_outstanding, probability, weighted_value,
        expected_revenue, payment_status, on_credit, due_date, metadata
      )
      VALUES ($1, 'sale', $2, 'Won', $3, $4, $5, $6, $7, $8, ($5 * $8 / 100.0), $5, $9, $10, $11, $12)
      ON CONFLICT (deal_id)
      DO UPDATE SET
        type = 'sale',
        status = EXCLUDED.status,
        stage = 'Won',
        title = EXCLUDED.title,
        customer_name = EXCLUDED.customer_name,
        amount_total = EXCLUDED.amount_total,
        amount_received = EXCLUDED.amount_received,
        amount_outstanding = EXCLUDED.amount_outstanding,
        probability = EXCLUDED.probability,
        weighted_value = EXCLUDED.weighted_value,
        expected_revenue = EXCLUDED.expected_revenue,
        payment_status = EXCLUDED.payment_status,
        on_credit = EXCLUDED.on_credit,
        due_date = EXCLUDED.due_date,
        metadata = revenue_records.metadata || EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        id,
        status,
        deal.title,
        deal.client_name || 'Unknown Customer',
        totalAmount,
        paid,
        outstanding,
        parseFloat(deal.probability || 100),
        paymentStatus,
        outstanding > 0,
        resolvedDueDate,
        JSON.stringify({ source: 'deal_conversion', notes }),
      ]
    );

    const revenue = revenueResult.rows[0];

    // Ensure legacy sales row exists and synced
    const saleResult = await query(
      `
      INSERT INTO sales (
        deal_id, customer_name, product_service, quantity, unit_price,
        amount, total_amount, sale_date, status, currency, notes,
        due_date, total_paid, remaining_balance, payment_status
      )
      VALUES ($1, $2, $3, 1, $4, $4, $4, CURRENT_TIMESTAMP,
              CASE WHEN $5 = 'Paid' THEN 'Paid' WHEN $5 = 'Partially Paid' THEN 'Partially Paid' ELSE 'Pending' END,
              'UGX', $6, $7, $8, $9, $5)
      ON CONFLICT (deal_id)
      DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        product_service = EXCLUDED.product_service,
        unit_price = EXCLUDED.unit_price,
        amount = EXCLUDED.amount,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        due_date = EXCLUDED.due_date,
        total_paid = EXCLUDED.total_paid,
        remaining_balance = EXCLUDED.remaining_balance,
        payment_status = EXCLUDED.payment_status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [
        id,
        deal.client_name || 'Unknown Customer',
        deal.title,
        totalAmount,
        paymentStatus,
        `Converted from deal #${id}${notes ? ` - ${notes}` : ''}`,
        resolvedDueDate,
        paid,
        outstanding,
      ]
    );

    const saleId = saleResult.rows[0].id;
    await query('UPDATE revenue_records SET sale_id = $1 WHERE id = $2', [saleId, revenue.id]);

    if (paid > 0) {
      await query(
        `
        INSERT INTO revenue_payments (revenue_id, sale_id, amount, payment_date, payment_method, notes)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'Other', 'Initial upfront payment on conversion')
        `,
        [revenue.id, saleId, paid]
      );

      await query(
        `
        INSERT INTO sales_payments (sale_id, amount, payment_date, payment_method, notes)
        VALUES ($1, $2, CURRENT_TIMESTAMP, 'Other', 'Initial upfront payment on conversion')
        `,
        [saleId, paid]
      );
    }

    if (outstanding > 0) {
      await query(
        `
        INSERT INTO revenue_receivables (revenue_id, amount_due, due_date, status, notes)
        VALUES ($1, $2, $3, CASE WHEN $3 < CURRENT_DATE THEN 'Overdue' ELSE 'Open' END, 'Generated from won on credit')
        ON CONFLICT DO NOTHING
        `,
        [revenue.id, outstanding, resolvedDueDate]
      );
    }

    return Response.json({
      success: true,
      message: 'Deal converted to sale successfully',
      data: {
        revenue_id: revenue.id,
        sale_id: saleId,
        deal_id: id,
        customer_name: revenue.customer_name,
        total_amount: parseFloat(revenue.amount_total || 0),
        amount_received: parseFloat(revenue.amount_received || 0),
        amount_outstanding: parseFloat(revenue.amount_outstanding || 0),
        payment_status: revenue.payment_status,
      },
    });
  } catch (error) {
    console.error('Convert to sale error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    // in case the table is missing we handle it below, but ensure it exists for future calls
    await ensureRevenueRecordsTable().catch(() => {});
    const { id } = params;

    // attempt to join with revenue_records; if table is missing, just return deal info
    try {
      const result = await query(
        `
      SELECT
        d.id,
        d.title,
        d.stage,
        d.value_estimate,
        rr.id as revenue_id,
        rr.sale_id,
        rr.status as revenue_status,
        rr.payment_status,
        rr.amount_total,
        rr.amount_received,
        rr.amount_outstanding
      FROM deals d
      LEFT JOIN revenue_records rr ON rr.deal_id = d.id
      WHERE d.id = $1 AND d.deleted_at IS NULL
      `,
        [id]
      );

      if (result.rowCount === 0) {
        return Response.json({ success: false, error: 'Deal not found' }, { status: 404 });
      }

      const row = result.rows[0];

      return Response.json({
        success: true,
        data: {
          deal_id: row.id,
          deal_title: row.title,
          deal_stage: row.stage,
          deal_value: parseFloat(row.value_estimate || 0),
          revenue_id: row.revenue_id,
          sale_id: row.sale_id,
          revenue_status: row.revenue_status,
          payment_status: row.payment_status,
          total_amount: row.amount_total ? parseFloat(row.amount_total) : null,
          amount_received: row.amount_received ? parseFloat(row.amount_received) : null,
          amount_outstanding: row.amount_outstanding ? parseFloat(row.amount_outstanding) : null,
          has_sale: row.sale_id !== null,
        },
      });
    } catch (inner) {
      if (inner.code === '42P01' || /revenue_records/.test(inner.message)) {
        // revenue_records table missing, just return deal data with empty sale info
        const dealRes = await query(`SELECT * FROM deals WHERE id = $1 AND deleted_at IS NULL`, [id]);
        if (dealRes.rowCount === 0) {
          return Response.json({ success: false, error: 'Deal not found' }, { status: 404 });
        }
        const deal = dealRes.rows[0];
        return Response.json({
          success: true,
          data: {
            deal_id: deal.id,
            deal_title: deal.title,
            deal_stage: deal.stage,
            deal_value: parseFloat(deal.value_estimate || 0),
            revenue_id: null,
            sale_id: null,
            revenue_status: null,
            payment_status: null,
            total_amount: null,
            amount_received: null,
            amount_outstanding: null,
            has_sale: false,
          },
        });
      }
      throw inner;
    }
  } catch (error) {
    console.error('Get deal sale info error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
