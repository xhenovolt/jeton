/**
 * GET /api/sales/report
 * Revenue report powered by unified revenue_records/payments/receivables
 */

import { query } from '@/lib/db.js';
import { ensureRevenueRecordsTable } from '@/lib/revenue.js';

export async function GET(request) {
  try {
    // the metrics rely on revenue_records; guarantee the table is present
    await ensureRevenueRecordsTable();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    let whereClause = "WHERE rr.type = 'sale'";
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND rr.created_at >= $${paramIndex}`;
      params.push(new Date(startDate).toISOString());
      paramIndex += 1;
    }

    if (endDate) {
      whereClause += ` AND rr.created_at < $${paramIndex}`;
      params.push(new Date(endDate).toISOString());
      paramIndex += 1;
    }

    if (status) {
      whereClause += ` AND rr.payment_status = $${paramIndex}`;
      params.push(status);
      paramIndex += 1;
    }

    // try to run the report against revenue_records
    try {
      const salesResult = await query(
        `
        SELECT
          rr.id,
          rr.customer_name,
          rr.title as product_service,
          rr.amount_total as total_amount,
          rr.amount_received as total_paid,
          rr.amount_outstanding as remaining_balance,
          rr.status,
          rr.payment_status,
          rr.created_at as sale_date,
          rr.due_date,
          rr.on_credit
        FROM revenue_records rr
        ${whereClause}
        ORDER BY rr.created_at DESC
        `,
        params
      );

      const metricsResult = await query(
        `
        SELECT
          COUNT(*)::INTEGER as total_sales,
          COUNT(CASE WHEN rr.payment_status = 'Paid' THEN 1 END)::INTEGER as paid_count,
          COUNT(CASE WHEN rr.payment_status = 'Partially Paid' THEN 1 END)::INTEGER as partial_count,
          COUNT(CASE WHEN rr.payment_status IN ('Unpaid', 'Credit', 'Overdue') THEN 1 END)::INTEGER as pending_count,
          COUNT(CASE WHEN rr.payment_status IN ('Credit', 'Overdue') THEN 1 END)::INTEGER as credit_count,
          COALESCE(SUM(rr.amount_total), 0)::DECIMAL as total_revenue,
          COALESCE(SUM(rr.amount_received), 0)::DECIMAL as total_collected,
          COALESCE(SUM(rr.amount_outstanding), 0)::DECIMAL as total_outstanding,
          COALESCE(SUM(CASE WHEN rr.payment_status IN ('Credit', 'Overdue') THEN rr.amount_outstanding ELSE 0 END), 0)::DECIMAL as credit_exposure,
          COALESCE(AVG(rr.amount_total), 0)::DECIMAL as avg_deal_size
        FROM revenue_records rr
        ${whereClause}
        `,
        params
      );

      const receivablesResult = await query(
        `
        SELECT
          COUNT(*)::INTEGER as open_receivables,
          COALESCE(SUM(amount_due), 0)::DECIMAL as open_amount,
          COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'Settled' THEN 1 END)::INTEGER as overdue_count,
          COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND status != 'Settled' THEN amount_due ELSE 0 END), 0)::DECIMAL as overdue_amount,
          COUNT(CASE WHEN due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 day' AND status != 'Settled' THEN 1 END)::INTEGER as upcoming_due_count,
          COALESCE(SUM(CASE WHEN due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 day' AND status != 'Settled' THEN amount_due ELSE 0 END), 0)::DECIMAL as upcoming_due_amount
        FROM revenue_receivables
        `
      );

      const dailyResult = await query(
        `
        SELECT
          DATE(rr.created_at) as date,
          COUNT(*)::INTEGER as count,
          COALESCE(SUM(rr.amount_total), 0)::DECIMAL as revenue,
          COALESCE(SUM(rr.amount_received), 0)::DECIMAL as collected
        FROM revenue_records rr
        ${whereClause}
        GROUP BY DATE(rr.created_at)
        ORDER BY date DESC
        `,
        params
      );

      const metrics = metricsResult.rows[0];
      const receivables = receivablesResult.rows[0];

      return Response.json({
        success: true,
        data: {
          metrics: {
            total_sales: Number(metrics.total_sales || 0),
            paid_count: Number(metrics.paid_count || 0),
            partial_count: Number(metrics.partial_count || 0),
            pending_count: Number(metrics.pending_count || 0),
            credit_count: Number(metrics.credit_count || 0),
            total_revenue: parseFloat(metrics.total_revenue || 0),
            total_collected: parseFloat(metrics.total_collected || 0),
            total_outstanding: parseFloat(metrics.total_outstanding || 0),
            credit_exposure: parseFloat(metrics.credit_exposure || 0),
            avg_deal_size: parseFloat(metrics.avg_deal_size || 0),
            collection_rate: parseFloat(metrics.total_revenue || 0) > 0
              ? ((parseFloat(metrics.total_collected || 0) / parseFloat(metrics.total_revenue || 0)) * 100).toFixed(1)
              : '0.0',
            open_receivables: Number(receivables.open_receivables || 0),
            overdue_count: Number(receivables.overdue_count || 0),
            overdue_amount: parseFloat(receivables.overdue_amount || 0),
            upcoming_due_count: Number(receivables.upcoming_due_count || 0),
            upcoming_due_amount: parseFloat(receivables.upcoming_due_amount || 0),
          },
          sales: salesResult.rows.map((row) => ({
            ...row,
            total_amount: parseFloat(row.total_amount || 0),
            total_paid: parseFloat(row.total_paid || 0),
            remaining_balance: parseFloat(row.remaining_balance || 0),
          })),
          productSummary: [],
          receivables: {
            open_amount: parseFloat(receivables.open_amount || 0),
            overdue_amount: parseFloat(receivables.overdue_amount || 0),
            upcoming_due_amount: parseFloat(receivables.upcoming_due_amount || 0),
          },
          dailySummary: dailyResult.rows.map((row) => ({
            date: row.date,
            count: Number(row.count || 0),
            revenue: parseFloat(row.revenue || 0),
            collected: parseFloat(row.collected || 0),
          })),
        },
      });
    } catch (innerErr) {
      // fallback when revenue_records table doesn't exist
      if (innerErr.code === '42P01' || /revenue_records/.test(innerErr.message)) {
        console.warn('Revenue records table missing, computing report from won deals only');
        // gather simple metrics from deals stage Won
        const dealsWhere = `WHERE stage = 'Won' AND deleted_at IS NULL` +
                            (startDate ? ` AND created_at >= $1` : '') +
                            (endDate ? ` AND created_at < $${startDate ? 2 : 1}` : '');
        const dateParams = [];
        if (startDate) dateParams.push(new Date(startDate).toISOString());
        if (endDate) dateParams.push(new Date(endDate).toISOString());

        const totalRes = await query(`SELECT COUNT(*)::INTEGER as total FROM deals ${dealsWhere}`, dateParams);
        const totalSales = Number(totalRes.rows[0].total || 0);
        return Response.json({
          success: true,
          data: {
            metrics: {
              total_sales: totalSales,
              paid_count: 0,
              partial_count: 0,
              pending_count: totalSales,
              credit_count: 0,
              total_revenue: 0,
              total_collected: 0,
              total_outstanding: 0,
              credit_exposure: 0,
              avg_deal_size: 0,
              collection_rate: '0.0',
              open_receivables: 0,
              overdue_count: 0,
              overdue_amount: 0,
              upcoming_due_count: 0,
              upcoming_due_amount: 0,
            },
            sales: [],
            productSummary: [],
            receivables: {
              open_amount: 0,
              overdue_amount: 0,
              upcoming_due_amount: 0,
            },
            dailySummary: [],
          },
        });
      }

      throw innerErr;
    }
  } catch (error) {
    console.error('Sales report error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
