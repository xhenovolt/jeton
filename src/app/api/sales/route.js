/**
 * GET/POST /api/sales
 * Unified sales endpoint backed by revenue_records (SSOT)
 */

import { query } from '@/lib/db.js';
import { ensureRevenueRecordsTable } from '@/lib/revenue.js';

function mapPaymentStatus(total, received, dueDate, onCredit) {
  const amountTotal = Number(total) || 0;
  const amountReceived = Number(received) || 0;
  const outstanding = Math.max(amountTotal - amountReceived, 0);

  if (outstanding <= 0 && amountTotal > 0) return 'Paid';
  if (amountReceived > 0) return 'Partially Paid';
  if (onCredit) {
    if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
    return 'Credit';
  }
  return 'Unpaid';
}

function mapRevenueStatus(paymentStatus, stage) {
  if (stage === 'Lost') return 'lost';
  if (paymentStatus === 'Paid') return 'paid';
  if (paymentStatus === 'Partially Paid') return 'partially_paid';
  if (paymentStatus === 'Credit' || paymentStatus === 'Overdue') return 'credit';
  if (stage === 'Won') return 'won';
  return 'open';
}

export async function GET(request) {
  try {
    // make sure the unified revenue table is available before doing any work
    await ensureRevenueRecordsTable();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const offset = (page - 1) * limit;

    // helper to build filters for revenue_records query
    let whereClauses = ['rr.type = \'sale\''];
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(rr.customer_name ILIKE $${paramIndex} OR rr.customer_email ILIKE $${paramIndex} OR rr.title ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    if (status) {
      whereClauses.push(`rr.payment_status = $${paramIndex}`);
      params.push(status);
      paramIndex += 1;
    }

    if (startDate) {
      whereClauses.push(`rr.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex += 1;
    }

    if (endDate) {
      whereClauses.push(`rr.created_at < $${paramIndex}`);
      params.push(endDate);
      paramIndex += 1;
    }

    const rrWhere = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // function to map revenue row to front-end shape
    const mapRow = (row) => ({
      ...row,
      quantity: Number(row.quantity || 1),
      unit_price: parseFloat(row.unit_price || row.amount || 0),
      amount: parseFloat(row.amount || 0),
      total_amount: parseFloat(row.total_amount || 0),
      total_paid: parseFloat(row.total_paid || 0),
      remaining_balance: parseFloat(row.remaining_balance || 0),
      status: row.payment_status === 'Paid'
        ? 'Paid'
        : row.payment_status === 'Partially Paid'
          ? 'Partially Paid'
          : 'Pending',
    });

    // attempt to query unified revenue_records first
    try {
      // fetch all revenue rows (no pagination) so we can merge with deal-based rows
      const rrAllResult = await query(
        `
        SELECT
          rr.id,
          rr.deal_id,
          rr.sale_id,
          rr.title as product_service,
          1::INTEGER as quantity,
          rr.amount_total as unit_price,
          rr.customer_name,
          rr.customer_email,
          rr.amount_total as amount,
          rr.amount_total as total_amount,
          rr.amount_received as total_paid,
          rr.amount_outstanding as remaining_balance,
          rr.payment_status,
          rr.status,
          rr.on_credit,
          rr.due_date,
          rr.created_at,
          rr.updated_at
        FROM revenue_records rr
        ${rrWhere}
        ORDER BY rr.created_at DESC
        `,
        params
      );

      // count and prepare initial sales list
      let rrRows = rrAllResult.rows;
      let total = rrRows.length;

      // optionally include standalone won deals (when no specific status filter applied)
      let wonDeals = [];
      if (!status) {
        const dealsParams = [];
        let dealsQuery = `SELECT id, title, client_name, value_estimate, expected_close_date, created_at, updated_at
                          FROM deals d
                          WHERE d.stage = 'Won' AND d.deleted_at IS NULL
                            AND NOT EXISTS (SELECT 1 FROM revenue_records rr2 WHERE rr2.deal_id = d.id AND rr2.type = 'sale')`;
        if (search) {
          dealsQuery += ` AND (d.client_name ILIKE $${dealsParams.length + 1} OR d.title ILIKE $${dealsParams.length + 1})`;
          dealsParams.push(`%${search}%`);
        }
        if (startDate) {
          dealsQuery += ` AND d.created_at >= $${dealsParams.length + 1}`;
          dealsParams.push(startDate);
        }
        if (endDate) {
          dealsQuery += ` AND d.created_at < $${dealsParams.length + 1}`;
          dealsParams.push(endDate);
        }

        const dealsAllResult = await query(`${dealsQuery} ORDER BY d.created_at DESC`, dealsParams);
        wonDeals = dealsAllResult.rows.map(r => ({
          id: null,
          deal_id: r.id,
          sale_id: null,
          product_service: r.title,
          quantity: 1,
          unit_price: r.value_estimate,
          customer_name: r.client_name,
          customer_email: null,
          amount: r.value_estimate,
          total_amount: r.value_estimate,
          total_paid: 0,
          remaining_balance: r.value_estimate,
          payment_status: 'Pending',
          status: 'won',
          on_credit: false,
          due_date: r.expected_close_date,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        total += wonDeals.length;
      }

      // combine and paginate in memory
      const combined = [...rrRows, ...wonDeals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const paged = combined.slice(offset, offset + limit);

      return Response.json({
        success: true,
        data: paged.map(mapRow),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (innerErr) {
      // if the unified table doesn't exist, fall back to won-deals only
      if (innerErr.code === '42P01' || /revenue_records/.test(innerErr.message)) {
        console.warn('Revenue records table missing, falling back to deals-only sales list');
        let dealsQuery = `SELECT id, title, client_name, value_estimate, expected_close_date, created_at, updated_at
                            FROM deals d
                            WHERE d.stage = 'Won' AND d.deleted_at IS NULL`;
        const dealsParams = [];
        if (search) {
          dealsQuery += ` AND (d.client_name ILIKE $${dealsParams.length + 1} OR d.title ILIKE $${dealsParams.length + 1})`;
          dealsParams.push(`%${search}%`);
        }
        if (startDate) {
          dealsQuery += ` AND d.created_at >= $${dealsParams.length + 1}`;
          dealsParams.push(startDate);
        }
        if (endDate) {
          dealsQuery += ` AND d.created_at < $${dealsParams.length + 1}`;
          dealsParams.push(endDate);
        }

        const countRes = await query(`SELECT COUNT(*)::INTEGER as total FROM (${dealsQuery}) x`, dealsParams);
        const total = Number(countRes.rows[0]?.total || 0);

        const rowsRes = await query(`${dealsQuery} ORDER BY d.created_at DESC LIMIT $${dealsParams.length + 1} OFFSET $${dealsParams.length + 2}`, [...dealsParams, limit, offset]);
        const sales = rowsRes.rows.map(r => ({
          id: null,
          deal_id: r.id,
          sale_id: null,
          product_service: r.title,
          quantity: 1,
          unit_price: r.value_estimate,
          customer_name: r.client_name,
          customer_email: null,
          amount: r.value_estimate,
          total_amount: r.value_estimate,
          total_paid: 0,
          remaining_balance: r.value_estimate,
          payment_status: 'Pending',
          status: 'won',
          on_credit: false,
          due_date: r.expected_close_date,
          created_at: r.created_at,
          updated_at: r.updated_at,
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
      }

      throw innerErr;
    }
  } catch (error) {
    console.error('Sales GET error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // ensure revenue_records exists so we can insert/update
    await ensureRevenueRecordsTable();
    const body = await request.json();

    const {
      deal_id,
      salesperson_id,
      customer_name,
      customer_email,
      amount,
      total_amount,
      product_service,
      quantity,
      unit_price,
      sale_date,
      due_date,
      payment_status,
      status,
      currency = 'UGX',
      notes,
    } = body;

    let resolvedCustomer = customer_name;
    let resolvedEmail = customer_email || null;
    let resolvedTitle = product_service || 'Sale';
    let resolvedAmount = Number(total_amount ?? amount);
    let resolvedProbability = 100;
    let resolvedStage = 'Won';

    if (deal_id) {
      const dealResult = await query(
        `SELECT id, title, client_name, value_estimate, probability, stage
         FROM deals WHERE id = $1 AND deleted_at IS NULL`,
        [deal_id]
      );

      if (dealResult.rowCount === 0) {
        return Response.json({ success: false, error: 'Deal not found for conversion' }, { status: 404 });
      }

      const deal = dealResult.rows[0];
      resolvedCustomer = resolvedCustomer || deal.client_name || 'Unknown Customer';
      resolvedTitle = resolvedTitle || deal.title || 'Sale';
      resolvedAmount = Number.isFinite(resolvedAmount) ? resolvedAmount : Number(deal.value_estimate || 0);
      resolvedProbability = Number(deal.probability || 100);
      resolvedStage = 'Won';

      if (deal.stage !== 'Won') {
        await query('UPDATE deals SET stage = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['Won', deal.id]);
      }
    }

    // Standalone sale requires explicit customer + amount
    if (!deal_id && (!resolvedCustomer || !Number.isFinite(resolvedAmount))) {
      return Response.json(
        {
          success: false,
          error: 'Standalone sales require customer_name and amount',
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(resolvedAmount) || resolvedAmount < 0) {
      return Response.json({ success: false, error: 'Amount must be non-negative' }, { status: 400 });
    }

    const resolvedDueDate = due_date || (deal_id ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) : null);
    const isCredit = payment_status === 'Credit' || payment_status === 'Overdue' || !!resolvedDueDate;
    const resolvedPaymentStatus = payment_status || mapPaymentStatus(resolvedAmount, 0, resolvedDueDate, isCredit);
    const resolvedRevenueStatus = status || mapRevenueStatus(resolvedPaymentStatus, resolvedStage);

    const revenueResult = await query(
      `
      INSERT INTO revenue_records (
        deal_id,
        type,
        status,
        stage,
        title,
        customer_name,
        customer_email,
        amount_total,
        amount_received,
        amount_outstanding,
        probability,
        weighted_value,
        expected_revenue,
        payment_status,
        on_credit,
        due_date,
        metadata
      )
      VALUES ($1, 'sale', $2, $3, $4, $5, $6, $7, 0, $7, $8, ($7 * $8 / 100.0), $7, $9, $10, $11, $12)
      ON CONFLICT (deal_id)
      DO UPDATE SET
        type = 'sale',
        status = EXCLUDED.status,
        stage = EXCLUDED.stage,
        title = EXCLUDED.title,
        customer_name = EXCLUDED.customer_name,
        customer_email = COALESCE(EXCLUDED.customer_email, revenue_records.customer_email),
        amount_total = EXCLUDED.amount_total,
        amount_outstanding = GREATEST(EXCLUDED.amount_total - revenue_records.amount_received, 0),
        probability = EXCLUDED.probability,
        weighted_value = EXCLUDED.weighted_value,
        expected_revenue = EXCLUDED.expected_revenue,
        payment_status = EXCLUDED.payment_status,
        on_credit = EXCLUDED.on_credit,
        due_date = COALESCE(EXCLUDED.due_date, revenue_records.due_date),
        metadata = revenue_records.metadata || EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        deal_id || null,
        resolvedRevenueStatus,
        resolvedStage,
        resolvedTitle,
        resolvedCustomer,
        resolvedEmail,
        resolvedAmount,
        resolvedProbability,
        resolvedPaymentStatus,
        isCredit,
        resolvedDueDate,
        JSON.stringify({
          source: deal_id ? 'deal_conversion' : 'standalone_sale',
          salesperson_id: salesperson_id || request.headers.get('x-user-id') || null,
          sale_date: sale_date || new Date().toISOString(),
          quantity: quantity || 1,
          unit_price: unit_price || resolvedAmount,
          currency,
          notes: notes || null,
        }),
      ]
    );

    const revenue = revenueResult.rows[0];

    // Keep legacy sales table synced for compatibility
    const saleResult = await query(
      `
      INSERT INTO sales (
        deal_id, customer_name, customer_email, product_service,
        quantity, unit_price, amount, total_amount, sale_date,
        status, currency, notes, due_date, total_paid, remaining_balance, payment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7, COALESCE($8, CURRENT_TIMESTAMP), $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (deal_id)
      DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_email = EXCLUDED.customer_email,
        product_service = EXCLUDED.product_service,
        quantity = EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        amount = EXCLUDED.amount,
        total_amount = EXCLUDED.total_amount,
        sale_date = EXCLUDED.sale_date,
        status = EXCLUDED.status,
        currency = EXCLUDED.currency,
        notes = EXCLUDED.notes,
        due_date = EXCLUDED.due_date,
        total_paid = EXCLUDED.total_paid,
        remaining_balance = EXCLUDED.remaining_balance,
        payment_status = EXCLUDED.payment_status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [
        deal_id || null,
        resolvedCustomer,
        resolvedEmail,
        resolvedTitle,
        quantity || 1,
        Number(unit_price || resolvedAmount),
        resolvedAmount,
        sale_date || null,
        resolvedPaymentStatus === 'Paid' ? 'Paid' : resolvedPaymentStatus === 'Partially Paid' ? 'Partially Paid' : 'Pending',
        currency,
        notes || null,
        resolvedDueDate,
        Number(revenue.amount_received || 0),
        Number(revenue.amount_outstanding || resolvedAmount),
        resolvedPaymentStatus,
      ]
    );

    const saleId = saleResult.rows[0]?.id || null;

    if (saleId && revenue.sale_id !== saleId) {
      await query('UPDATE revenue_records SET sale_id = $1 WHERE id = $2', [saleId, revenue.id]);
    }

    // Auto-create receivable for credit/outstanding
    if (Number(revenue.amount_outstanding || 0) > 0) {
      await query(
        `
        INSERT INTO revenue_receivables (revenue_id, amount_due, due_date, status, notes)
        VALUES ($1, $2, COALESCE($3, CURRENT_DATE + INTERVAL '30 day'),
                CASE WHEN COALESCE($3, CURRENT_DATE + INTERVAL '30 day') < CURRENT_DATE THEN 'Overdue' ELSE 'Open' END,
                $4)
        ON CONFLICT DO NOTHING
        `,
        [revenue.id, revenue.amount_outstanding, resolvedDueDate, 'Auto-generated receivable from sale creation']
      );
    }

    return Response.json(
      {
        success: true,
        data: {
          id: revenue.id,
          deal_id: revenue.deal_id,
          sale_id: saleId,
          customer_name: revenue.customer_name,
          customer_email: revenue.customer_email,
          product_service: revenue.title,
          quantity: 1,
          unit_price: parseFloat(revenue.amount_total || 0),
          amount: parseFloat(revenue.amount_total || 0),
          total_amount: parseFloat(revenue.amount_total || 0),
          total_paid: parseFloat(revenue.amount_received || 0),
          remaining_balance: parseFloat(revenue.amount_outstanding || 0),
          payment_status: revenue.payment_status,
          status: revenue.payment_status === 'Paid'
            ? 'Paid'
            : revenue.payment_status === 'Partially Paid'
              ? 'Partially Paid'
              : 'Pending',
          revenue_status: revenue.status,
          due_date: revenue.due_date,
          on_credit: revenue.on_credit,
          created_at: revenue.created_at,
          updated_at: revenue.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Sales POST error:', error);
    return Response.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
        details: error.detail || error.hint,
      },
      { status: 500 }
    );
  }
}
