/**
 * Database Integrity Audit Tool
 * 
 * Detects structural violations:
 * - Deals without system_id
 * - Deals without prospect/client link
 * - Contracts without system
 * - Payments without allocations
 * - Share allocations exceeding 100%
 * 
 * Run this weekly to catch inconsistencies
 */

import { query } from './db.js';

/**
 * Run full integrity audit
 * @returns {Promise<Object>} Audit results with violations and stats
 */
export async function runIntegrityAudit() {
  try {
    const startTime = Date.now();
    const violations = [];
    const stats = {};

    // ========== CHECK 1: Deals Missing System ==========
    try {
      const dealsMissingSystem = await query(`
        SELECT 
          id, 
          title, 
          stage, 
          created_by,
          created_at
        FROM deals 
        WHERE system_id IS NULL AND deleted_at IS NULL
        LIMIT 100
      `);

      if (dealsMissingSystem.rowCount > 0) {
        violations.push({
          severity: 'CRITICAL',
          issue: 'deals_missing_system',
          count: dealsMissingSystem.rowCount,
          description: 'Deals without system_id cannot be properly attributed. These deals are incomplete.',
          examples: dealsMissingSystem.rows.slice(0, 3),
          fix: 'Update deals to set system_id before they can be won.',
        });
      }
      stats.deals_missing_system = dealsMissingSystem.rowCount;
    } catch (e) {
      console.warn('Could not check deals/system relationship:', e.message);
      stats.deals_missing_system = 'N/A (table missing)';
    }

    // ========== CHECK 2: Deals Without Prospect or Client ==========
    try {
      const dealsOrphan = await query(`
        SELECT 
          id, 
          title, 
          stage, 
          created_by,
          created_at
        FROM deals 
        WHERE prospect_id IS NULL 
          AND client_id IS NULL 
          AND deleted_at IS NULL
        LIMIT 100
      `);

      if (dealsOrphan.rowCount > 0) {
        violations.push({
          severity: 'CRITICAL',
          issue: 'deals_missing_prospect_or_client',
          count: dealsOrphan.rowCount,
          description: 'Deals must link to a person (prospect or client). These are orphaned anonymous deals.',
          examples: dealsOrphan.rows.slice(0, 3),
          fix: 'Link deals to prospect_id or client_id before proceeding.',
        });
      }
      stats.deals_orphaned = dealsOrphan.rowCount;
    } catch (e) {
      console.warn('Could not check deal orphan status:', e.message);
      stats.deals_orphaned = 'N/A (table missing)';
    }

    // ========== CHECK 3: Contracts Without System ==========
    try {
      const contractsOrphan = await query(`
        SELECT 
          id, 
          client_id, 
          status,
          created_at
        FROM contracts 
        WHERE system_id IS NULL
        LIMIT 100
      `);

      if (contractsOrphan.rowCount > 0) {
        violations.push({
          severity: 'CRITICAL',
          issue: 'contracts_missing_system',
          count: contractsOrphan.rowCount,
          description: 'Contracts must be tied to a system. These are unattached contracts.',
          examples: contractsOrphan.rows.slice(0, 3),
          fix: 'Update contracts to set system_id.',
        });
      }
      stats.contracts_missing_system = contractsOrphan.rowCount;
    } catch (e) {
      console.warn('Could not check contracts:', e.message);
      stats.contracts_missing_system = 'N/A (table missing)';
    }

    // ========== CHECK 4: Payments Pending Allocation ==========
    try {
      const paymentsPending = await query(`
        SELECT 
          id, 
          amount_received, 
          date_received,
          created_at,
          (amount_received - allocated_amount) as unallocated_amount
        FROM payments 
        WHERE allocation_status = 'pending' AND created_at < CURRENT_DATE - INTERVAL '7 days'
        LIMIT 100
      `);

      if (paymentsPending.rowCount > 0) {
        violations.push({
          severity: 'WARNING',
          issue: 'payments_stale_pending',
          count: paymentsPending.rowCount,
          description: `${paymentsPending.rowCount} payments received over 7 days ago but not yet allocated. Money is sitting in limbo.`,
          examples: paymentsPending.rows.slice(0, 3),
          fix: 'Allocate these payments to operating, vault, expenses, or investment accounts.',
        });
      }
      stats.payments_pending_allocation = paymentsPending.rowCount;
    } catch (e) {
      console.warn('Could not check payments:', e.message);
      stats.payments_pending_allocation = 'N/A (table missing)';
    }

    // ========== CHECK 5: Share Allocations Exceeds 100% ==========
    try {
      const sharesTotal = await query(`
        SELECT COALESCE(SUM(percentage), 0) as total
        FROM share_allocations
      `);

      const totalShares = parseFloat(sharesTotal.rows[0].total || 0);
      stats.total_share_allocation_percent = totalShares.toFixed(2);

      if (totalShares > 100 || (totalShares < 100 && totalShares > 0)) {
        violations.push({
          severity: totalShares > 100 ? 'CRITICAL' : 'WARNING',
          issue: 'share_allocation_mismatch',
          count: 1,
          description: `Share allocations total ${totalShares.toFixed(2)}% (should be exactly 100% or 0% if not set).`,
          current_total: totalShares.toFixed(2),
          fix: 'Adjust shareholder percentages to sum exactly 100%.',
        });
      }
    } catch (e) {
      console.warn('Could not check shares:', e.message);
      stats.share_allocation_check = 'N/A (table missing)';
    }

    // ========== CHECK 6: Won Deals Without Contracts ==========
    try {
      const wonDealsNoContract = await query(`
        SELECT 
          d.id, 
          d.title,
          d.client_id,
          d.system_id,
          d.value_estimate,
          d.created_at
        FROM deals d
        WHERE d.stage = 'Won' 
          AND d.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM contracts c 
            WHERE c.client_id = d.client_id AND c.system_id = d.system_id
          )
        LIMIT 100
      `);

      if (wonDealsNoContract.rowCount > 0) {
        violations.push({
          severity: 'CRITICAL',
          issue: 'won_deals_without_contract',
          count: wonDealsNoContract.rowCount,
          description: `${wonDealsNoContract.rowCount} deals are marked Won but have no corresponding contract. Revenue tracking is broken.`,
          examples: wonDealsNoContract.rows.slice(0, 3),
          fix: 'Automatically create contracts when deals are won. Check migration 032 trigger.',
        });
      }
      stats.won_deals_without_contract = wonDealsNoContract.rowCount;
    } catch (e) {
      console.warn('Could not check won deals:', e.message);
      stats.won_deals_without_contract = 'N/A (tables missing)';
    }

    // ========== SUMMARY ==========
    const auditResult = {
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      violation_count: violations.length,
      critical_count: violations.filter(v => v.severity === 'CRITICAL').length,
      warning_count: violations.filter(v => v.severity === 'WARNING').length,
      violations: violations,
      stats: stats,
      overall_health: violations.filter(v => v.severity === 'CRITICAL').length === 0 ? 'GOOD' : 'NEEDS ATTENTION',
    };

    return auditResult;
  } catch (error) {
    console.error('Fatal error during integrity audit:', error);
    throw error;
  }
}

/**
 * Get quick health status (single query version)
 * @returns {Promise<Object>} Health metrics
 */
export async function getHealthStatus() {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM deals WHERE system_id IS NULL AND deleted_at IS NULL)::int as deals_missing_system,
        (SELECT COUNT(*) FROM deals WHERE prospect_id IS NULL AND client_id IS NULL AND deleted_at IS NULL)::int as deals_orphaned,
        (SELECT COUNT(*) FROM contracts WHERE system_id IS NULL)::int as contracts_missing_system,
        (SELECT COUNT(*) FROM payments WHERE allocation_status = 'pending')::int as payments_pending,
        (SELECT COALESCE(SUM(percentage), 0) FROM share_allocations) as share_total
    `);

    const health = result.rows[0];
    const criticalIssues = (health.deals_missing_system || 0) + 
                          (health.deals_orphaned || 0) + 
                          (health.contracts_missing_system || 0);

    return {
      deals_missing_system: health.deals_missing_system || 0,
      deals_orphaned: health.deals_orphaned || 0,
      contracts_missing_system: health.contracts_missing_system || 0,
      payments_pending: health.payments_pending || 0,
      share_allocation_percent: parseFloat(health.share_total || 0).toFixed(2),
      critical_issue_count: criticalIssues,
      status: criticalIssues > 0 ? '⚠️ NEEDS ATTENTION' : '✓ HEALTHY',
    };
  } catch (error) {
    if (error.message.includes('does not exist')) {
      return {
        error: 'Database not fully initialized',
        status: 'SCHEMA INCOMPLETE',
      };
    }
    throw error;
  }
}

export default {
  runIntegrityAudit,
  getHealthStatus,
};
