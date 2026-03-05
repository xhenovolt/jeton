/**
 * GET /api/financial-dashboard
 * Comprehensive financial metrics and founder-level KPIs
 * Returns complete snapshot of revenue, expenses, allocations, and profitability
 *
 * Query parameters:
 * - startDate: filter by date range
 * - endDate: filter by date range
 * - systemId: focus on single system
 * - clientId: focus on single client
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const systemId = searchParams.get('systemId');
    const clientId = searchParams.get('clientId');

    // Build dynamic WHERE clauses depending on filters
    let contractFilter = '';
    const filterParams = [];
    let paramIdx = 1;

    if (systemId) {
      contractFilter += ` AND c.system_id = $${paramIdx++}`;
      filterParams.push(parseInt(systemId));
    }

    if (clientId) {
      contractFilter += ` AND c.client_id = $${paramIdx++}`;
      filterParams.push(clientId);
    }

    let dateFilter = '';
    if (startDate) {
      dateFilter += ` AND p.date_received >= $${paramIdx++}`;
      filterParams.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND p.date_received <= $${paramIdx++}`;
      filterParams.push(endDate);
    }

    // ====================================================================
    // REVENUE METRICS
    // ====================================================================

    // Total revenue collected (all payments)
    const totalRevenueResult = await query(
      `SELECT
         COALESCE(SUM(p.amount_received), 0)::numeric as total_collected,
         COUNT(p.id)::integer as payment_count,
         COUNT(DISTINCT p.contract_id)::integer as contracts_with_payments
       FROM payments p
       JOIN contracts c ON p.contract_id = c.id
       WHERE 1=1 ${contractFilter} ${dateFilter}`,
      filterParams
    );

    const totalRevenue = totalRevenueResult.rows[0];

    // Installation revenue
    const installationRevenueResult = await query(
      `SELECT
         COALESCE(SUM(c.installation_fee), 0)::numeric as installation_total,
         COUNT(DISTINCT c.id)::integer as contracts_with_installation
       FROM contracts c
       WHERE c.installation_fee > 0 ${contractFilter}`,
      filterParams.slice(0, filterParams.length - (dateFilter ? 2 : 0))
    );

    const installationRevenue = installationRevenueResult.rows[0];

    // Recurring revenue (active contracts)
    const recurringRevenueResult = await query(
      `SELECT
         COALESCE(SUM(c.recurring_amount), 0)::numeric as monthly_recurring,
         COUNT(DISTINCT c.id)::integer as active_recurring_contracts
       FROM contracts c
       WHERE c.recurring_enabled = true AND c.status = 'active' ${contractFilter}`,
      filterParams.slice(0, filterParams.length - (dateFilter ? 2 : 0))
    );

    const recurringRevenue = recurringRevenueResult.rows[0];

    // ====================================================================
    // EXPENSE METRICS
    // ====================================================================

    const expensesResult = await query(
      `SELECT
         COALESCE(SUM(e.amount), 0)::numeric as total_expenses,
         COUNT(e.id)::integer as expense_count
       FROM expenses e
       WHERE 1=1 ${dateFilter}`,
      filterParams.slice(-2)
    );

    const expenses = expensesResult.rows[0];

    // Expenses by category
    const expensesByCategoryResult = await query(
      `SELECT
         ec.id,
         ec.name,
         ec.is_system_defined,
         COALESCE(SUM(e.amount), 0)::numeric as total,
         COUNT(e.id)::integer as count
       FROM expense_categories ec
       LEFT JOIN expenses e ON ec.id = e.category_id ${dateFilter ? 'AND ' + dateFilter.substring(5) : ''}
       GROUP BY ec.id, ec.name, ec.is_system_defined
       ORDER BY total DESC`,
      filterParams.slice(-2)
    );

    const expensesByCategory = expensesByCategoryResult.rows.map(row => ({
      ...row,
      total: parseFloat(row.total),
    }));

    // ====================================================================
    // ALLOCATION METRICS
    // ====================================================================

    const allocationsResult = await query(
      `SELECT
         a.allocation_type,
         COALESCE(SUM(a.amount), 0)::numeric as total,
         COUNT(a.id)::integer as allocation_count
       FROM allocations a
       JOIN payments p ON a.payment_id = p.id
       JOIN contracts c ON p.contract_id = c.id
       WHERE 1=1 ${contractFilter} ${dateFilter}
       GROUP BY a.allocation_type`,
      filterParams
    );

    const allocations = {};
    allocationsResult.rows.forEach(row => {
      allocations[row.allocation_type] = {
        total: parseFloat(row.total),
        count: row.allocation_count,
      };
    });

    // ====================================================================
    // PROFITABILITY
    // ====================================================================

    const totalCollected = parseFloat(totalRevenue.total_collected);
    const totalExpenses = parseFloat(expenses.total_expenses);
    const netProfit = totalCollected - totalExpenses;

    // ====================================================================
    // CASH POSITION
    // ====================================================================

    const vaultBalance = parseFloat(allocations['vault']?.total || 0);
    const operatingBalance = parseFloat(allocations['operating']?.total || 0);
    const investmentAllocated = parseFloat(allocations['investment']?.total || 0);

    // ====================================================================
    // REVENUE PER SYSTEM
    // ====================================================================

    const revenuePerSystemResult = await query(
      `SELECT
         ip.id,
         ip.name,
         COUNT(DISTINCT c.id)::integer as contract_count,
         COALESCE(SUM(c.installation_fee), 0)::numeric as installation_revenue,
         COALESCE(SUM(c.recurring_amount), 0)::numeric as monthly_recurring,
         COALESCE(SUM(p.amount_received), 0)::numeric as total_collected
       FROM intellectual_property ip
       LEFT JOIN contracts c ON ip.id = c.system_id ${contractFilter ? contractFilter.includes('c.system_id') ? '' : contractFilter : ''}
       LEFT JOIN payments p ON c.id = p.contract_id ${dateFilter}
       GROUP BY ip.id, ip.name
       ORDER BY total_collected DESC`,
      filterParams
    );

    const revenuePerSystem = revenuePerSystemResult.rows.map(row => ({
      system_id: row.id,
      system_name: row.name,
      contract_count: row.contract_count,
      installation_revenue: parseFloat(row.installation_revenue),
      monthly_recurring: parseFloat(row.monthly_recurring),
      total_collected: parseFloat(row.total_collected),
    }));

    // ====================================================================
    // REVENUE PER CLIENT
    // ====================================================================

    const revenuePerClientResult = await query(
      `SELECT
         cl.id,
         cl.name,
         COUNT(DISTINCT c.id)::integer as contract_count,
         COALESCE(SUM(p.amount_received), 0)::numeric as total_collected,
         MAX(p.date_received) as last_payment_date,
         cl.status as client_status
       FROM clients cl
       LEFT JOIN contracts c ON cl.id = c.client_id ${contractFilter ? contractFilter.replace('c.system_id', 'cl.id') : ''}
       LEFT JOIN payments p ON c.id = p.contract_id ${dateFilter}
       GROUP BY cl.id, cl.name, cl.status
       ORDER BY total_collected DESC
       LIMIT 20`,
      filterParams
    );

    const revenuePerClient = revenuePerClientResult.rows.map(row => ({
      client_id: row.id,
      client_name: row.name,
      contract_count: row.contract_count,
      total_collected: parseFloat(row.total_collected),
      last_payment_date: row.last_payment_date,
      status: row.client_status,
    }));

    // ====================================================================
    // SYSTEM-LEVEL INTELLIGENCE
    // ====================================================================

    const systemIntelligenceResult = await query(
      `SELECT
         ip.id,
         ip.name,
         COUNT(DISTINCT c.id)::integer as total_contracts,
         COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.client_id ELSE NULL END)::integer as active_clients,
         COALESCE(SUM(c.installation_fee), 0)::numeric as installation_revenue_total,
         COALESCE(SUM(CASE WHEN c.recurring_enabled = true AND c.status = 'active' THEN c.recurring_amount ELSE 0 END), 0)::numeric as monthly_recurring_total,
         COUNT(DISTINCT CASE WHEN c.status = 'completed' OR c.status = 'suspended' THEN c.client_id ELSE NULL END)::integer as churned_clients
       FROM intellectual_property ip
       LEFT JOIN contracts c ON ip.id = c.system_id
       GROUP BY ip.id, ip.name
       ORDER BY installation_revenue_total + COALESCE(SUM(CASE WHEN c.recurring_enabled = true AND c.status = 'active' THEN c.recurring_amount ELSE 0 END), 0) DESC`
    );

    const systemIntelligence = systemIntelligenceResult.rows.map(row => ({
      system_id: row.id,
      system_name: row.name,
      total_contracts: row.total_contracts,
      active_clients: row.active_clients,
      installation_revenue_total: parseFloat(row.installation_revenue_total),
      monthly_recurring_total: parseFloat(row.monthly_recurring_total),
      churned_clients: row.churned_clients,
    }));

    // ====================================================================
    // DETECT MONEY ISSUES
    // ====================================================================

    // Find orphaned/unallocated payments
    const orphanedResult = await query(
      `SELECT COUNT(*)::integer as orphaned_count
       FROM payments p
       WHERE (p.amount_received - COALESCE(p.allocated_amount, 0)) > 0.01 ${dateFilter}`,
      filterParams.slice(-2)
    );

    const orphanedCount = orphanedResult.rows[0].orphaned_count;

    // Find unfinalized payments that are not fully allocated
    const unfinalizedResult = await query(
      `SELECT
         COUNT(*)::integer as unfinalized_count,
         COALESCE(SUM(p.amount_received - COALESCE(p.allocated_amount, 0)), 0)::numeric as unallocated_amount
       FROM payments p
       WHERE p.allocation_status = 'pending' ${dateFilter}`,
      filterParams.slice(-2)
    );

    const unfinalized = unfinalizedResult.rows[0];

    // ====================================================================
    // RECURRING REVENUE FORECAST
    // ====================================================================

    const monthlyRecurring = parseFloat(recurringRevenue.monthly_recurring);
    const projectedAnnual = monthlyRecurring * 12;

    return Response.json({
      success: true,
      dashboard: {
        // Revenue metrics
        revenue: {
          total_collected: totalCollected,
          installation_total: parseFloat(installationRevenue.installation_total),
          monthly_recurring: monthlyRecurring,
          annual_recurring_projection: projectedAnnual,
          payment_count: totalRevenue.payment_count,
          contracts_with_revenue: totalRevenue.contracts_with_payments,
        },

        // Expense metrics
        expenses: {
          total_expenses: totalExpenses,
          expense_count: expenses.expense_count,
          by_category: expensesByCategory,
        },

        // Allocation metrics (where revenue went)
        allocations: {
          vault: allocations['vault'] || { total: 0, count: 0 },
          operating: allocations['operating'] || { total: 0, count: 0 },
          investment: allocations['investment'] || { total: 0, count: 0 },
          expense: allocations['expense'] || { total: 0, count: 0 },
          custom: allocations['custom'] || { total: 0, count: 0 },
        },

        // Profitability
        profitability: {
          gross_revenue: totalCollected,
          total_expenses: totalExpenses,
          net_profit: netProfit,
          profit_margin: totalCollected > 0 ? (netProfit / totalCollected) * 100 : 0,
        },

        // Cash position
        cash_position: {
          vault_balance: vaultBalance,
          operating_balance: operatingBalance,
          investment_allocated: investmentAllocated,
          total_allocated: vaultBalance + operatingBalance + investmentAllocated,
        },

        // Data issues
        data_integrity: {
          orphaned_unallocated_payments: orphanedCount,
          unfinalized_payments: unfinalized.unfinalized_count,
          unallocated_amount: parseFloat(unfinalized.unallocated_amount),
          healthy: orphanedCount === 0 && unfinalized.unfinalized_count === 0,
        },

        // Intelligence
        intelligence: {
          top_systems: systemIntelligence.slice(0, 5),
          top_clients: revenuePerClient.slice(0, 5),
          all_systems_metrics: revenuePerSystem,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching financial dashboard:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
