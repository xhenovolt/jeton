/**
 * GET /api/financial-audit
 * Comprehensive financial data integrity check
 * Detects:
 * - Orphaned/unallocated payments
 * - Overallocated payments
 * - Missing allocations
 * - Inconsistent contract/payment relationships
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    // ====================================================================
    // CHECK 1: ORPHANED PAYMENTS (money with no allocation)
    // ====================================================================
    const orphanedResult = await query(
      `SELECT
         p.id,
         p.contract_id,
         p.amount_received,
         p.allocated_amount,
         (p.amount_received - p.allocated_amount)::numeric as unallocated_amount,
         c.client_id,
         cl.name as client_name,
         ip.name as system_name
       FROM payments p
       JOIN contracts c ON p.contract_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       WHERE (p.amount_received - p.allocated_amount) > 0.01
       ORDER BY p.created_at DESC`
    );

    const orphaned = orphanedResult.rows.map(row => ({
      ...row,
      amount_received: parseFloat(row.amount_received),
      allocated_amount: parseFloat(row.allocated_amount),
      unallocated_amount: parseFloat(row.unallocated_amount),
    }));

    // ====================================================================
    // CHECK 2: OVERALLOCATED PAYMENTS (allocations > payment amount)
    // ====================================================================
    const overallocatedResult = await query(
      `SELECT
         p.id,
         p.contract_id,
         p.amount_received,
         p.allocated_amount,
         (p.allocated_amount - p.amount_received)::numeric as overallocation,
         c.client_id,
         cl.name as client_name
       FROM payments p
       JOIN contracts c ON p.contract_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE p.allocated_amount > p.amount_received + 0.01
       ORDER BY p.created_at DESC`
    );

    const overallocated = overallocatedResult.rows.map(row => ({
      ...row,
      amount_received: parseFloat(row.amount_received),
      allocated_amount: parseFloat(row.allocated_amount),
      overallocation: parseFloat(row.overallocation),
    }));

    // ====================================================================
    // CHECK 3: CONTRACTS WITHOUT PAYMENTS
    // ====================================================================
    const contractsWithoutPaymentsResult = await query(
      `SELECT
         c.id,
         c.client_id,
         cl.name as client_name,
         ip.name as system_name,
         c.installation_fee,
         c.recurring_enabled,
         c.recurring_amount,
         c.status,
         c.created_at
       FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       WHERE c.id NOT IN (SELECT DISTINCT contract_id FROM payments)
       AND c.status NOT IN ('draft', 'completed', 'suspended')
       ORDER BY c.created_at DESC`
    );

    const contractsWithoutPayments = contractsWithoutPaymentsResult.rows.map(row => ({
      ...row,
      installation_fee: parseFloat(row.installation_fee),
      recurring_amount: row.recurring_amount ? parseFloat(row.recurring_amount) : null,
    }));

    // ====================================================================
    // CHECK 4: RECURRING CONTRACTS NOT RECEIVING REGULAR PAYMENTS
    // ====================================================================
    const recurringNoPaymentResult = await query(
      `SELECT
         c.id,
         c.client_id,
         cl.name as client_name,
         ip.name as system_name,
         c.recurring_cycle,
         c.recurring_amount,
         COALESCE(MAX(p.date_received), '1900-01-01')::date as last_payment_date,
         (CURRENT_DATE - COALESCE(MAX(p.date_received), '1900-01-01')::date)::integer as days_since_last_payment
       FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       LEFT JOIN payments p ON c.id = p.contract_id
       WHERE c.recurring_enabled = true
       AND c.status = 'active'
       GROUP BY c.id, c.client_id, cl.name, ip.name, c.recurring_cycle, c.recurring_amount
       HAVING COALESCE(MAX(p.date_received), '1900-01-01')::date < CURRENT_DATE - INTERVAL '45 days'
       ORDER BY days_since_last_payment DESC`
    );

    const recurringNoPay = recurringNoPaymentResult.rows.map(row => ({
      ...row,
      last_payment_date: row.last_payment_date,
      recurring_amount: parseFloat(row.recurring_amount),
      days_since_last_payment: row.days_since_last_payment,
    }));

    // ====================================================================
    // CHECK 5: EXPENSES WITHOUT ALLOCATION LINK (dangling expenses)
    // ====================================================================
    const expensesNoLinkResult = await query(
      `SELECT
         e.id,
         e.amount,
         e.expense_date,
         e.description,
         ec.name as category_name
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.linked_allocation_id IS NULL
       ORDER BY e.expense_date DESC`
    );

    const expensesNoLink = expensesNoLinkResult.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount),
    }));

    // ====================================================================
    // CHECK 6: UNFINALIZED PAYMENTS (allocation_status = 'pending')
    // ====================================================================
    const unfinalizedResult = await query(
      `SELECT
         p.id,
         p.contract_id,
         p.amount_received,
         p.allocated_amount,
         (p.amount_received - p.allocated_amount)::numeric as unallocated_amount,
         c.client_id,
         cl.name as client_name,
         p.created_at
       FROM payments p
       JOIN contracts c ON p.contract_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE p.allocation_status = 'pending'
       ORDER BY p.created_at DESC`
    );

    const unfinalized = unfinalizedResult.rows.map(row => ({
      ...row,
      amount_received: parseFloat(row.amount_received),
      allocated_amount: parseFloat(row.allocated_amount),
      unallocated_amount: parseFloat(row.unallocated_amount),
    }));

    // ====================================================================
    // OVERALL HEALTH CHECK
    // ====================================================================
    const healthCheck = {
      has_orphaned_money: orphaned.length > 0,
      has_overallocations: overallocated.length > 0,
      has_active_contracts_without_payments: contractsWithoutPayments.length > 0,
      has_delinquent_recurring: recurringNoPay.length > 0,
      has_unlinked_expenses: expensesNoLink.length > 0,
      has_unfinalized_payments: unfinalized.length > 0,
      is_healthy: orphaned.length === 0 && 
                  overallocated.length === 0 && 
                  unfinalized.length === 0 &&
                  recurringNoPay.length === 0,
    };

    return Response.json({
      success: true,
      audit: {
        // Critical Issues
        critical: {
          orphaned_payments: {
            count: orphaned.length,
            total_unallocated: orphaned.reduce((sum, p) => sum + p.unallocated_amount, 0),
            payments: orphaned,
          },
          overallocated_payments: {
            count: overallocated.length,
            total_overallocation: overallocated.reduce((sum, p) => sum + p.overallocation, 0),
            payments: overallocated,
          },
        },

        // Warning Issues
        warnings: {
          contracts_without_revenue: {
            count: contractsWithoutPayments.length,
            contracts: contractsWithoutPayments,
          },
          delinquent_recurring_contracts: {
            count: recurringNoPay.length,
            contracts: recurringNoPay,
          },
          unlinked_expenses: {
            count: expensesNoLink.length,
            expenses: expensesNoLink.slice(0, 20),
          },
        },

        // Pending Items
        pending: {
          unfinalized_payments: {
            count: unfinalized.length,
            total_unallocated: unfinalized.reduce((sum, p) => sum + p.unallocated_amount, 0),
            payments: unfinalized.slice(0, 20),
          },
        },

        // Overall
        health: healthCheck,
      },
    });
  } catch (error) {
    console.error('Error running financial audit:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
