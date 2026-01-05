/**
 * GET /api/reports/pipeline
 * Comprehensive pipeline and sales analytics
 * Supports date ranges, filtering by owner, stage, and currency
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || null;
    const endDate = searchParams.get('endDate') || null;
    const ownerId = searchParams.get('ownerId') || null;
    const stage = searchParams.get('stage') || null;
    const timeframe = searchParams.get('timeframe') || 'daily'; // daily, weekly, monthly, yearly
    const includeCharts = searchParams.get('charts') !== 'false';

    // Build where clauses
    let dealWhere = 'WHERE d.deleted_at IS NULL AND d.status = \'ACTIVE\'';
    let salesWhere = 'WHERE s.deal_id IS NOT NULL';
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      dealWhere += ` AND d.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      dealWhere += ` AND d.created_at < $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (ownerId) {
      dealWhere += ` AND d.created_by = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (stage) {
      dealWhere += ` AND d.stage = $${paramIndex}`;
      params.push(stage);
      paramIndex++;
    }

    // ========================================
    // 1. SUMMARY METRICS
    // ========================================

    const metricsQuery = `
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
        COALESCE(SUM(CASE WHEN s.status = 'Paid' THEN s.total_amount ELSE 0 END), 0)::DECIMAL as revenue_collected,
        COALESCE(SUM(CASE WHEN s.status IN ('Pending', 'Partially Paid') THEN s.remaining_balance ELSE 0 END), 0)::DECIMAL as revenue_pending
      FROM deals d
      LEFT JOIN sales s ON d.id = s.deal_id
      ${dealWhere}
    `;

    const metricsResult = await query(metricsQuery, params);
    const metrics = metricsResult.rows[0];

    // Calculate conversion rate
    const conversionRate = metrics.total_deals > 0
      ? ((metrics.won_deals_count / metrics.total_deals) * 100).toFixed(1)
      : 0;

    // ========================================
    // 2. BY STAGE BREAKDOWN
    // ========================================

    const byStageQuery = `
      SELECT
        d.stage,
        COUNT(*) as deal_count,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as stage_value,
        COALESCE(AVG(d.value_estimate), 0)::DECIMAL as avg_value,
        COALESCE(SUM(d.value_estimate * d.probability / 100), 0)::DECIMAL as weighted_value,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.id END) as deals_with_sales,
        COALESCE(SUM(s.total_amount), 0)::DECIMAL as total_sales_amount
      FROM deals d
      LEFT JOIN sales s ON d.id = s.deal_id
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
    `;

    const byStageResult = await query(byStageQuery, params);

    // ========================================
    // 3. BY OWNER BREAKDOWN
    // ========================================

    const byOwnerQuery = `
      SELECT
        d.created_by as owner_id,
        u.name as owner_name,
        COUNT(DISTINCT d.id) as total_deals,
        COUNT(DISTINCT CASE WHEN d.stage = 'Won' THEN d.id END) as won_deals,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as owner_pipeline_value,
        COALESCE(SUM(CASE WHEN d.stage = 'Won' THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as owner_won_value,
        COALESCE(SUM(d.value_estimate * d.probability / 100), 0)::DECIMAL as owner_weighted_value,
        COALESCE(SUM(s.total_amount), 0)::DECIMAL as owner_sales_total
      FROM deals d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN sales s ON d.id = s.deal_id
      ${dealWhere}
      GROUP BY d.created_by, u.name
      ORDER BY owner_won_value DESC NULLS LAST
    `;

    const byOwnerResult = await query(byOwnerQuery, params);

    // ========================================
    // 4. DAILY/WEEKLY/MONTHLY TRENDS
    // ========================================

    let dateGroup = 'DATE(d.created_at)';
    let dateLabel = 'date';

    if (timeframe === 'weekly') {
      dateGroup = 'DATE_TRUNC(\'week\', d.created_at)::DATE';
      dateLabel = 'week_start';
    } else if (timeframe === 'monthly') {
      dateGroup = 'DATE_TRUNC(\'month\', d.created_at)::DATE';
      dateLabel = 'month_start';
    } else if (timeframe === 'yearly') {
      dateGroup = 'DATE_TRUNC(\'year\', d.created_at)::DATE';
      dateLabel = 'year_start';
    }

    const trendsQuery = `
      SELECT
        ${dateGroup} as period_date,
        COUNT(DISTINCT d.id) as deals_count,
        COALESCE(SUM(d.value_estimate), 0)::DECIMAL as period_revenue,
        COUNT(DISTINCT CASE WHEN d.stage = 'Won' THEN d.id END) as period_won_count,
        COALESCE(SUM(CASE WHEN d.stage = 'Won' THEN d.value_estimate ELSE 0 END), 0)::DECIMAL as period_won_value,
        COALESCE(SUM(s.total_amount), 0)::DECIMAL as period_sales_total,
        COALESCE(SUM(CASE WHEN s.status = 'Paid' THEN s.total_amount ELSE 0 END), 0)::DECIMAL as period_paid_revenue
      FROM deals d
      LEFT JOIN sales s ON d.id = s.deal_id
      ${dealWhere}
      GROUP BY period_date
      ORDER BY period_date DESC
      LIMIT 365
    `;

    const trendsResult = await query(trendsQuery, params);

    // ========================================
    // 5. DEAL-TO-SALES CONVERSION
    // ========================================

    const conversionQuery = `
      SELECT
        d.id as deal_id,
        d.title as deal_title,
        d.client_name,
        d.value_estimate as deal_value,
        d.stage as deal_stage,
        s.id as sale_id,
        s.status as sale_status,
        s.total_amount as sale_amount,
        s.total_paid,
        s.remaining_balance,
        CASE WHEN s.id IS NOT NULL THEN true ELSE false END as has_sale
      FROM deals d
      LEFT JOIN sales s ON d.id = s.deal_id
      WHERE d.stage = 'Won' AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC
      LIMIT 100
    `;

    const conversionResult = await query(conversionQuery, []);

    // ========================================
    // 6. FUNNEL ANALYSIS (stage transitions)
    // ========================================

    const funnelQuery = `
      SELECT
        'Lead' as stage,
        COUNT(*) as count,
        1 as position
      FROM deals
      WHERE deleted_at IS NULL AND status = 'ACTIVE' AND stage IN ('Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost')
      
      UNION ALL
      
      SELECT
        'Contacted' as stage,
        COUNT(*) as count,
        2 as position
      FROM deals
      WHERE deleted_at IS NULL AND status = 'ACTIVE' AND stage IN ('Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost')
      
      UNION ALL
      
      SELECT
        'Proposal Sent' as stage,
        COUNT(*) as count,
        3 as position
      FROM deals
      WHERE deleted_at IS NULL AND status = 'ACTIVE' AND stage IN ('Proposal Sent', 'Negotiation', 'Won', 'Lost')
      
      UNION ALL
      
      SELECT
        'Negotiation' as stage,
        COUNT(*) as count,
        4 as position
      FROM deals
      WHERE deleted_at IS NULL AND status = 'ACTIVE' AND stage IN ('Negotiation', 'Won', 'Lost')
      
      UNION ALL
      
      SELECT
        'Won' as stage,
        COUNT(*) as count,
        5 as position
      FROM deals
      WHERE deleted_at IS NULL AND status = 'ACTIVE' AND stage = 'Won'
      
      ORDER BY position
    `;

    const funnelResult = await query(funnelQuery, []);

    return Response.json({
      success: true,
      data: {
        metrics: {
          total_deals: metrics.total_deals,
          won_deals: metrics.won_deals_count,
          lost_deals: metrics.lost_deals_count,
          pending_deals: metrics.pending_deals_count,
          total_pipeline_value: parseFloat(metrics.total_pipeline_value),
          won_deals_value: parseFloat(metrics.won_deals_value),
          lost_deals_value: parseFloat(metrics.lost_deals_value),
          pending_deals_value: parseFloat(metrics.pending_deals_value),
          weighted_pipeline_value: parseFloat(metrics.weighted_pipeline_value),
          avg_deal_value: parseFloat(metrics.avg_deal_value),
          conversion_rate: parseFloat(conversionRate),
          revenue_collected: parseFloat(metrics.revenue_collected),
          revenue_pending: parseFloat(metrics.revenue_pending),
        },
        by_stage: byStageResult.rows.map(row => ({
          stage: row.stage,
          deal_count: row.deal_count,
          stage_value: parseFloat(row.stage_value),
          avg_value: parseFloat(row.avg_value),
          weighted_value: parseFloat(row.weighted_value),
          deals_with_sales: row.deals_with_sales,
          total_sales_amount: parseFloat(row.total_sales_amount),
        })),
        by_owner: byOwnerResult.rows.map(row => ({
          owner_id: row.owner_id,
          owner_name: row.owner_name,
          total_deals: row.total_deals,
          won_deals: row.won_deals,
          pipeline_value: parseFloat(row.owner_pipeline_value),
          won_value: parseFloat(row.owner_won_value),
          weighted_value: parseFloat(row.owner_weighted_value),
          sales_total: parseFloat(row.owner_sales_total),
        })),
        trends: trendsResult.rows.map(row => ({
          period_date: row.period_date,
          deals_count: row.deals_count,
          period_revenue: parseFloat(row.period_revenue),
          won_count: row.period_won_count,
          won_value: parseFloat(row.period_won_value),
          sales_total: parseFloat(row.period_sales_total),
          paid_revenue: parseFloat(row.period_paid_revenue),
        })),
        conversions: conversionResult.rows.map(row => ({
          deal_id: row.deal_id,
          deal_title: row.deal_title,
          client_name: row.client_name,
          deal_value: parseFloat(row.deal_value),
          sale_id: row.sale_id,
          sale_status: row.sale_status,
          sale_amount: row.sale_amount ? parseFloat(row.sale_amount) : null,
          total_paid: row.total_paid ? parseFloat(row.total_paid) : null,
          remaining_balance: row.remaining_balance ? parseFloat(row.remaining_balance) : null,
          has_sale: row.has_sale,
        })),
        funnel: funnelResult.rows.map(row => ({
          stage: row.stage,
          count: row.count,
          position: row.position,
        })),
      },
    });
  } catch (error) {
    console.error('Pipeline report error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
