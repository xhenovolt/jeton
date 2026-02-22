/**
 * GET /api/reports/pipeline
 * Unified pipeline/revenue analytics (cash vs promise)
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || null;
    const endDate = searchParams.get('endDate') || null;
    const ownerId = searchParams.get('ownerId') || null;
    const stage = searchParams.get('stage') || null;
    const timeframe = searchParams.get('timeframe') || 'daily';

    let dealWhere = "WHERE d.deleted_at IS NULL AND d.status = 'ACTIVE'";
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      dealWhere += ` AND d.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex += 1;
    }

    if (endDate) {
      dealWhere += ` AND d.created_at < $${paramIndex}`;
      params.push(endDate);
      paramIndex += 1;
    }

    if (ownerId) {
      dealWhere += ` AND d.created_by = $${paramIndex}`;
      params.push(ownerId);
      paramIndex += 1;
    }

    if (stage) {
      dealWhere += ` AND d.stage = $${paramIndex}`;
      params.push(stage);
      paramIndex += 1;
    }

    const metricsResult = await query(
      `
      SELECT
        COUNT(DISTINCT d.id) as total_deals,
        COUNT(DISTINCT CASE WHEN d.stage = 'Won' THEN d.id END) as won_deals_count,
        COUNT(DISTINCT CASE WHEN d.stage = 'Lost' THEN d.id END) as lost_deals_count,
        COUNT(DISTINCT CASE WHEN d.stage NOT IN ('Won', 'Lost') THEN d.id END) as pending_deals_count,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as total_pipeline_value,
        COALESCE(SUM(CASE WHEN d.stage = 'Won' THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as won_deals_value,
        COALESCE(SUM(CASE WHEN d.stage = 'Lost' THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as lost_deals_value,
        COALESCE(SUM(CASE WHEN d.stage NOT IN ('Won', 'Lost') THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as pending_deals_value,
        COALESCE(SUM(d.value_estimate * d.probability / 100), 0)::DECIMAL as weighted_pipeline_value,
        COALESCE(AVG(d.value_estimate), 0)::DECIMAL as avg_deal_value,
        COALESCE(SUM(rr.amount_received), 0)::DECIMAL as revenue_collected,
        COALESCE(SUM(rr.amount_outstanding), 0)::DECIMAL as revenue_pending,
        COALESCE(SUM(CASE WHEN rr.payment_status IN ('Credit', 'Overdue') THEN rr.amount_outstanding ELSE 0 END), 0)::DECIMAL as credit_exposure,
        COUNT(CASE WHEN rr.payment_status IN ('Credit', 'Overdue') THEN 1 END) as credit_sales_count,
        COUNT(CASE WHEN rr.payment_status = 'Overdue' THEN 1 END) as overdue_clients
      FROM deals d
      LEFT JOIN revenue_records rr ON rr.deal_id = d.id
      ${dealWhere}
      `,
      params
    );

    const metrics = metricsResult.rows[0];
    const conversionRate = Number(metrics.total_deals || 0) > 0
      ? ((Number(metrics.won_deals_count || 0) / Number(metrics.total_deals || 0)) * 100).toFixed(1)
      : '0.0';

    const stageResult = await query(
      `
      SELECT
        d.stage,
        COUNT(*) as deal_count,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as stage_value,
        COALESCE(AVG(d.value_estimate), 0)::DECIMAL as avg_value,
        COALESCE(SUM(d.value_estimate * d.probability / 100), 0)::DECIMAL as weighted_value,
        COALESCE(SUM(rr.amount_received), 0)::DECIMAL as cash_collected,
        COALESCE(SUM(rr.amount_outstanding), 0)::DECIMAL as promise_value
      FROM deals d
      LEFT JOIN revenue_records rr ON rr.deal_id = d.id
      ${dealWhere}
      GROUP BY d.stage
      ORDER BY
        CASE
          WHEN d.stage = 'Lead' THEN 1
          WHEN d.stage = 'Contacted' THEN 2
          WHEN d.stage = 'Proposal Sent' THEN 3
          WHEN d.stage = 'Negotiation' THEN 4
          WHEN d.stage = 'Won' THEN 5
          WHEN d.stage = 'Lost' THEN 6
          ELSE 7
        END
      `,
      params
    );

    const ownerResult = await query(
      `
      SELECT
        d.created_by as owner_id,
        u.name as owner_name,
        COUNT(DISTINCT d.id) as total_deals,
        COUNT(DISTINCT CASE WHEN d.stage = 'Won' THEN d.id END) as won_deals,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as pipeline_value,
        COALESCE(SUM(CASE WHEN d.stage = 'Won' THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as won_value,
        COALESCE(SUM(d.value_estimate * d.probability / 100), 0)::DECIMAL as weighted_value,
        COALESCE(SUM(rr.amount_received), 0)::DECIMAL as collected_cash
      FROM deals d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN revenue_records rr ON rr.deal_id = d.id
      ${dealWhere}
      GROUP BY d.created_by, u.name
      ORDER BY won_value DESC NULLS LAST
      `,
      params
    );

    let dateGroup = 'DATE(d.created_at)';
    if (timeframe === 'weekly') dateGroup = "DATE_TRUNC('week', d.created_at)::DATE";
    else if (timeframe === 'monthly') dateGroup = "DATE_TRUNC('month', d.created_at)::DATE";
    else if (timeframe === 'yearly') dateGroup = "DATE_TRUNC('year', d.created_at)::DATE";

    const trendsResult = await query(
      `
      SELECT
        ${dateGroup} as period_date,
        COUNT(DISTINCT d.id) as deals_count,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as period_revenue,
        COUNT(DISTINCT CASE WHEN d.stage = 'Won' THEN d.id END) as period_won_count,
        COALESCE(SUM(CASE WHEN d.stage = 'Won' THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as period_won_value,
        COALESCE(SUM(rr.amount_received), 0)::DECIMAL as period_cash,
        COALESCE(SUM(rr.amount_outstanding), 0)::DECIMAL as period_promise
      FROM deals d
      LEFT JOIN revenue_records rr ON rr.deal_id = d.id
      ${dealWhere}
      GROUP BY period_date
      ORDER BY period_date DESC
      LIMIT 365
      `,
      params
    );

    const conversionsResult = await query(
      `
      SELECT
        d.id as deal_id,
        d.title as deal_title,
        d.client_name,
        d.value_estimate as deal_value,
        rr.id as revenue_id,
        rr.sale_id,
        rr.status as sale_status,
        rr.payment_status,
        rr.amount_total as sale_amount,
        rr.amount_received as total_paid,
        rr.amount_outstanding as remaining_balance,
        CASE WHEN rr.id IS NOT NULL THEN true ELSE false END as has_sale
      FROM deals d
      LEFT JOIN revenue_records rr ON rr.deal_id = d.id AND rr.type = 'sale'
      WHERE d.stage = 'Won' AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC
      LIMIT 100
      `
    );

    const receivablesSummary = await query(
      `
      SELECT
        COUNT(*)::INTEGER as total_credit_sales,
        COUNT(CASE WHEN status = 'Overdue' THEN 1 END)::INTEGER as overdue_clients,
        COUNT(CASE WHEN due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 day' AND status != 'Settled' THEN 1 END)::INTEGER as upcoming_due_payments,
        COALESCE(SUM(CASE WHEN status = 'Overdue' THEN amount_due ELSE 0 END), 0)::DECIMAL as overdue_amount
      FROM revenue_receivables
      `
    );

    const rec = receivablesSummary.rows[0] || {};

    const salesVelocity = Number(metrics.won_deals_count || 0) > 0
      ? (Number(metrics.won_deals_value || 0) / Number(metrics.won_deals_count || 1))
      : 0;

    return Response.json({
      success: true,
      data: {
        metrics: {
          total_deals: Number(metrics.total_deals || 0),
          won_deals: Number(metrics.won_deals_count || 0),
          lost_deals: Number(metrics.lost_deals_count || 0),
          pending_deals: Number(metrics.pending_deals_count || 0),
          total_pipeline_value: parseFloat(metrics.total_pipeline_value || 0),
          won_deals_value: parseFloat(metrics.won_deals_value || 0),
          lost_deals_value: parseFloat(metrics.lost_deals_value || 0),
          pending_deals_value: parseFloat(metrics.pending_deals_value || 0),
          weighted_pipeline_value: parseFloat(metrics.weighted_pipeline_value || 0),
          revenue_collected: parseFloat(metrics.revenue_collected || 0),
          revenue_pending: parseFloat(metrics.revenue_pending || 0),
          credit_exposure: parseFloat(metrics.credit_exposure || 0),
          conversion_rate: parseFloat(conversionRate),
          avg_deal_size: parseFloat(metrics.avg_deal_value || 0),
          sales_velocity: parseFloat(salesVelocity || 0),
          cash_vs_promise: {
            cash: parseFloat(metrics.revenue_collected || 0),
            promise: parseFloat(metrics.revenue_pending || 0),
          },
          total_credit_sales: Number(rec.total_credit_sales || metrics.credit_sales_count || 0),
          overdue_clients: Number(rec.overdue_clients || metrics.overdue_clients || 0),
          upcoming_due_payments: Number(rec.upcoming_due_payments || 0),
          overdue_amount: parseFloat(rec.overdue_amount || 0),
        },
        by_stage: stageResult.rows.map((row) => ({
          stage: row.stage,
          deal_count: Number(row.deal_count || 0),
          stage_value: parseFloat(row.stage_value || 0),
          avg_value: parseFloat(row.avg_value || 0),
          weighted_value: parseFloat(row.weighted_value || 0),
          cash_collected: parseFloat(row.cash_collected || 0),
          promise_value: parseFloat(row.promise_value || 0),
        })),
        by_owner: ownerResult.rows.map((row) => ({
          owner_id: row.owner_id,
          owner_name: row.owner_name,
          total_deals: Number(row.total_deals || 0),
          won_deals: Number(row.won_deals || 0),
          pipeline_value: parseFloat(row.pipeline_value || 0),
          won_value: parseFloat(row.won_value || 0),
          weighted_value: parseFloat(row.weighted_value || 0),
          sales_total: parseFloat(row.collected_cash || 0),
        })),
        trends: trendsResult.rows.map((row) => ({
          period_date: row.period_date,
          deals_count: Number(row.deals_count || 0),
          period_revenue: parseFloat(row.period_revenue || 0),
          won_count: Number(row.period_won_count || 0),
          won_value: parseFloat(row.period_won_value || 0),
          sales_total: parseFloat(row.period_cash || 0),
          paid_revenue: parseFloat(row.period_cash || 0),
          promise_revenue: parseFloat(row.period_promise || 0),
        })),
        conversions: conversionsResult.rows.map((row) => ({
          deal_id: row.deal_id,
          deal_title: row.deal_title,
          client_name: row.client_name,
          deal_value: parseFloat(row.deal_value || 0),
          sale_id: row.sale_id,
          sale_status: row.sale_status,
          payment_status: row.payment_status,
          sale_amount: row.sale_amount ? parseFloat(row.sale_amount) : null,
          total_paid: row.total_paid ? parseFloat(row.total_paid) : null,
          remaining_balance: row.remaining_balance ? parseFloat(row.remaining_balance) : null,
          has_sale: row.has_sale,
        })),
        funnel: [],
      },
    });
  } catch (error) {
    console.error('Pipeline report error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
