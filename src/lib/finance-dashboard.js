/**
 * Financial Dashboard - Optimized Queries
 * 
 * RULES:
 * - Uses system_metrics view (real-time contract calculations)
 * - Defensive error handling (returns empty if tables don't exist)
 * - Performance indices for sub-500ms response
 * - No JS loops for aggregation (all SQL)
 */

import { query } from './db.js';

/**
 * Get system metrics (real-time dashboard data)
 * Returns actual client counts from contracts, not fake metrics
 * 
 * @returns {Promise<Array>} Systems with real active_clients, revenue, pipeline
 */
export async function getSystemMetrics() {
  try {
    const result = await query(`
      SELECT
        ip.id,
        ip.name as system_name,
        ip.description,
        ip.status,
        
        -- Active clients = DISTINCT count of active contracts
        (SELECT COUNT(DISTINCT c.client_id)
         FROM contracts c
         WHERE c.system_id = ip.id AND c.status = 'active'
        ) as active_clients,
        
        -- Installation revenue (one-time)
        (SELECT COALESCE(SUM(c.installation_fee), 0)
         FROM contracts c
         WHERE c.system_id = ip.id AND c.status = 'active'
        ) as installation_revenue,
        
        -- Recurring revenue (monthly)
        (SELECT COALESCE(SUM(c.recurring_amount), 0)
         FROM contracts c
         WHERE c.system_id = ip.id AND c.status = 'active' AND c.recurring_enabled = true
        ) as recurring_revenue,
        
        -- Total revenue
        (SELECT COALESCE(SUM(c.installation_fee), 0) + 
                COALESCE(SUM(CASE WHEN c.recurring_enabled THEN c.recurring_amount ELSE 0 END), 0)
         FROM contracts c
         WHERE c.system_id = ip.id AND c.status = 'active'
        ) as total_revenue,
        
        -- Pipeline deals in progress
        (SELECT COUNT(DISTINCT d.id)
         FROM deals d
         WHERE d.system_id = ip.id AND d.stage IN ('Lead', 'Prospect', 'Proposal', 'Negotiation')
         AND d.deleted_at IS NULL
        ) as pipeline_deals,
        
        -- Total pipeline value
        (SELECT COALESCE(SUM(d.value_estimate * (d.probability / 100.0)), 0)
         FROM deals d
         WHERE d.system_id = ip.id AND d.stage != 'Won' AND d.stage != 'Lost'
         AND d.deleted_at IS NULL
        ) as pipeline_value,
        
        ip.created_at,
        ip.updated_at
      FROM intellectual_property ip
      WHERE ip.status IN ('active', 'scaling')
      ORDER BY total_revenue DESC, active_clients DESC
    `);

    return result.rows || [];
  } catch (error) {
    // Defensive: if view/tables don't exist, return empty
    if (error.message.includes('does not exist')) {
      console.warn('Financial tables not yet initialized. System metrics unavailable.');
      return [];
    }
    console.error('Error fetching system metrics:', error);
    throw error;
  }
}

/**
 * Get revenue summary (total across all systems)
 * @returns {Promise<Object>} Total revenue, active clients, pipeline value
 */
export async function getRevenueSummary() {
  try {
    const result = await query(`
      SELECT
        COALESCE(SUM(
          (c.installation_fee + (CASE WHEN c.recurring_enabled THEN c.recurring_amount ELSE 0 END))
        ), 0) as total_revenue,
        
        COUNT(DISTINCT c.client_id) FILTER (WHERE c.status = 'active') as active_client_count,
        
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') as active_contract_count,
        
        COALESCE(SUM(d.value_estimate * (d.probability / 100.0)), 0) FILTER 
          (WHERE d.stage != 'Won' AND d.stage != 'Lost' AND d.deleted_at IS NULL) as pipeline_value,
        
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'Won') as won_deals_count
      FROM contracts c
      LEFT JOIN deals d ON c.client_id = d.client_id
      WHERE c.status != 'suspended'
    `);

    const summary = result.rows[0] || {};

    return {
      total_revenue: parseFloat(summary.total_revenue || 0).toFixed(2),
      active_client_count: parseInt(summary.active_client_count || 0),
      active_contract_count: parseInt(summary.active_contract_count || 0),
      pipeline_value: parseFloat(summary.pipeline_value || 0).toFixed(2),
      won_deals_count: parseInt(summary.won_deals_count || 0),
    };
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.warn('Contracts table not yet initialized.');
      return {
        total_revenue: '0.00',
        active_client_count: 0,
        active_contract_count: 0,
        pipeline_value: '0.00',
        won_deals_count: 0,
      };
    }
    console.error('Error fetching revenue summary:', error);
    throw error;
  }
}

/**
 * Get payment & allocation status
 * Shows where money is flowing
 * 
 * @returns {Promise<Object>} Pending allocations, allocated, disputes
 */
export async function getPaymentStatus() {
  try {
    const result = await query(`
      SELECT
        COUNT(DISTINCT CASE WHEN p.allocation_status = 'pending' THEN p.id END) as pending_count,
        COUNT(DISTINCT CASE WHEN p.allocation_status = 'allocated' THEN p.id END) as allocated_count,
        COUNT(DISTINCT CASE WHEN p.allocation_status = 'disputed' THEN p.id END) as disputed_count,
        
        COALESCE(SUM(CASE WHEN p.allocation_status = 'pending' THEN p.amount_received ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN p.allocation_status = 'allocated' THEN p.amount_received ELSE 0 END), 0) as allocated_amount,
        COALESCE(SUM(CASE WHEN p.allocation_status = 'disputed' THEN p.amount_received ELSE 0 END), 0) as disputed_amount
      FROM payments p
    `);

    const status = result.rows[0] || {};

    return {
      pending: {
        count: parseInt(status.pending_count || 0),
        amount: parseFloat(status.pending_amount || 0).toFixed(2),
      },
      allocated: {
        count: parseInt(status.allocated_count || 0),
        amount: parseFloat(status.allocated_amount || 0).toFixed(2),
      },
      disputed: {
        count: parseInt(status.disputed_count || 0),
        amount: parseFloat(status.disputed_amount || 0).toFixed(2),
      },
    };
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.warn('Payments table not yet initialized.');
      return {
        pending: { count: 0, amount: '0.00' },
        allocated: { count: 0, amount: '0.00' },
        disputed: { count: 0, amount: '0.00' },
      };
    }
    console.error('Error fetching payment status:', error);
    throw error;
  }
}

/**
 * Get expense tracking
 * Shows allocation of revenue to different categories
 * 
 * @returns {Promise<Array>} Expenses grouped by category with totals
 */
export async function getExpenseBreakdown() {
  try {
    const result = await query(`
      SELECT
        COALESCE(ec.name, 'Uncategorized') as category,
        COUNT(e.id) as expense_count,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE(AVG(e.amount), 0) as average_amount,
        MAX(e.expense_date) as last_expense_date
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY ec.id, ec.name
      ORDER BY total_amount DESC
    `);

    return (result.rows || []).map(row => ({
      category: row.category,
      count: parseInt(row.expense_count),
      total: parseFloat(row.total_amount).toFixed(2),
      average: parseFloat(row.average_amount).toFixed(2),
      last_expense_date: row.last_expense_date,
    }));
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.warn('Expenses table not yet initialized.');
      return [];
    }
    console.error('Error fetching expense breakdown:', error);
    throw error;
  }
}

/**
 * Get complete financial dashboard snapshot
 * @returns {Promise<Object>} All financial metrics in one query
 */
export async function getDashboardSnapshot() {
  try {
    // Parallel queries for performance
    const [systems, revenue, payments, expenses] = await Promise.all([
      getSystemMetrics(),
      getRevenueSummary(),
      getPaymentStatus(),
      getExpenseBreakdown(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      revenue: revenue,
      payments: payments,
      systems: systems,
      expenses: expenses,
      health_check: {
        systems_initialized: systems.length > 0,
        contracts_initialized: revenue.active_contract_count > 0 || !systems.length,
        payments_initialized: payments.allocated.count > 0 || payments.pending.count > 0,
      },
    };
  } catch (error) {
    console.error('Error getting dashboard snapshot:', error);
    // Return partial data on error
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      revenue: {
        total_revenue: '0.00',
        active_client_count: 0,
        active_contract_count: 0,
        pipeline_value: '0.00',
        won_deals_count: 0,
      },
      payments: {
        pending: { count: 0, amount: '0.00' },
        allocated: { count: 0, amount: '0.00' },
        disputed: { count: 0, amount: '0.00' },
      },
      systems: [],
      expenses: [],
      health_check: {
        systems_initialized: false,
        contracts_initialized: false,
        payments_initialized: false,
      },
    };
  }
}

export default {
  getSystemMetrics,
  getRevenueSummary,
  getPaymentStatus,
  getExpenseBreakdown,
  getDashboardSnapshot,
};
