/**
 * GET /api/sales/report
 * Get sales report with date filtering and aggregate metrics
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    // Build where clause
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND s.sale_date >= $${paramIndex}`;
      params.push(new Date(startDate).toISOString());
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND s.sale_date < $${paramIndex}`;
      params.push(new Date(endDate).toISOString());
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Fetch detailed sales data
    const salesResult = await query(
      `
      SELECT 
        s.id,
        s.customer_name,
        s.product_service,
        s.quantity,
        s.unit_price,
        s.total_amount,
        s.status,
        s.sale_date,
        s.currency,
        COALESCE(SUM(sp.amount), 0)::DECIMAL as total_paid
      FROM sales s
      LEFT JOIN sales_payments sp ON s.id = sp.sale_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.sale_date DESC
      `,
      params
    );

    // Calculate aggregate metrics
    const metricsResult = await query(
      `
      SELECT 
        COUNT(DISTINCT s.id)::INTEGER as total_sales,
        COUNT(DISTINCT CASE WHEN s.status = 'Paid' THEN s.id END)::INTEGER as paid_count,
        COUNT(DISTINCT CASE WHEN s.status = 'Partially Paid' THEN s.id END)::INTEGER as partial_count,
        COUNT(DISTINCT CASE WHEN s.status = 'Pending' THEN s.id END)::INTEGER as pending_count,
        SUM(s.total_amount)::DECIMAL as total_revenue,
        SUM(COALESCE(sp.amount, 0))::DECIMAL as total_collected,
        SUM(s.total_amount - COALESCE(sp.amount, 0))::DECIMAL as total_outstanding
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount)::DECIMAL as amount
        FROM sales_payments
        GROUP BY sale_id
      ) sp ON s.id = sp.sale_id
      ${whereClause}
      `,
      params
    );

    // Get sales by product summary
    const productSummaryResult = await query(
      `
      SELECT 
        s.product_service,
        COUNT(*)::INTEGER as count,
        SUM(s.quantity)::INTEGER as total_quantity,
        SUM(s.total_amount)::DECIMAL as total_revenue,
        SUM(COALESCE(sp.amount, 0))::DECIMAL as total_collected
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount)::DECIMAL as amount
        FROM sales_payments
        GROUP BY sale_id
      ) sp ON s.id = sp.sale_id
      ${whereClause}
      GROUP BY s.product_service
      ORDER BY total_revenue DESC
      `,
      params
    );

    // Get daily sales summary for chart
    const dailySalesResult = await query(
      `
      SELECT 
        DATE(s.sale_date) as date,
        COUNT(*)::INTEGER as count,
        SUM(s.total_amount)::DECIMAL as revenue,
        SUM(COALESCE(sp.amount, 0))::DECIMAL as collected
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount)::DECIMAL as amount
        FROM sales_payments
        GROUP BY sale_id
      ) sp ON s.id = sp.sale_id
      ${whereClause}
      GROUP BY DATE(s.sale_date)
      ORDER BY date DESC
      `,
      params
    );

    const metrics = metricsResult.rows[0];

    return Response.json({
      success: true,
      data: {
        metrics: {
          total_sales: metrics.total_sales,
          paid_count: metrics.paid_count,
          partial_count: metrics.partial_count,
          pending_count: metrics.pending_count,
          total_revenue: parseFloat(metrics.total_revenue || 0),
          total_collected: parseFloat(metrics.total_collected || 0),
          total_outstanding: parseFloat(metrics.total_outstanding || 0),
          collection_rate: metrics.total_revenue > 0 
            ? ((parseFloat(metrics.total_collected || 0) / parseFloat(metrics.total_revenue)) * 100).toFixed(1)
            : 0,
        },
        sales: salesResult.rows.map(row => ({
          ...row,
          quantity: parseInt(row.quantity),
          unit_price: parseFloat(row.unit_price),
          total_amount: parseFloat(row.total_amount),
          total_paid: parseFloat(row.total_paid),
          remaining_balance: parseFloat(row.total_amount) - parseFloat(row.total_paid),
        })),
        productSummary: productSummaryResult.rows.map(row => ({
          product_service: row.product_service,
          count: row.count,
          total_quantity: row.total_quantity,
          total_revenue: parseFloat(row.total_revenue || 0),
          total_collected: parseFloat(row.total_collected || 0),
        })),
        dailySummary: dailySalesResult.rows.map(row => ({
          date: row.date,
          count: row.count,
          revenue: parseFloat(row.revenue || 0),
          collected: parseFloat(row.collected || 0),
        })),
      },
    });
  } catch (error) {
    console.error('Sales report error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
