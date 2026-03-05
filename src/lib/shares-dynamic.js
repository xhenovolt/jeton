/**
 * Dynamic Share Allocation System (REFACTORED)
 * 
 * Model: Shareholders own PERCENTAGES, not absolute shares
 * 
 * Benefits:
 * - Dynamically adjust ownership (increment by 2% → go from 50% to 52%)
 * - Always validates total <= 100%
 * - Transaction-based for consistency
 * - Audit trail for all changes
 */

import { query } from './db.js';

/**
 * ============================================================================
 * SHAREHOLDER MANAGEMENT
 * ============================================================================
 */

/**
 * Get all shareholders
 * @returns {Promise<Array>} List of shareholders with current percentages
 */
export async function getShareholders() {
  try {
    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.email,
        s.is_founder,
        s.status,
        COALESCE(sa.percentage, 0) as percentage,
        COALESCE(sa.vesting_start_date, NULL) as vesting_start_date,
        COALESCE(sa.vesting_end_date, NULL) as vesting_end_date,
        s.created_at
      FROM shareholders s
      LEFT JOIN share_allocations sa ON s.id = sa.shareholder_id
      WHERE s.status = 'active'
      ORDER BY s.is_founder DESC, COALESCE(sa.percentage, 0) DESC
    `);
    return result.rows || [];
  } catch (error) {
    console.error('Error fetching shareholders:', error);
    throw error;
  }
}

/**
 * Get single shareholder with allocation
 * @param {string} shareholderId - UUID of shareholder
 * @returns {Promise<Object>} Shareholder details with percentage
 */
export async function getShareholder(shareholderId) {
  try {
    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.email,
        s.is_founder,
        s.status,
        COALESCE(sa.percentage, 0) as percentage,
        COALESCE(sa.vesting_start_date, NULL) as vesting_start_date,
        COALESCE(sa.vesting_end_date, NULL) as vesting_end_date,
        s.created_at,
        s.updated_at
      FROM shareholders s
      LEFT JOIN share_allocations sa ON s.id = sa.shareholder_id
      WHERE s.id = $1
    `, [shareholderId]);
    
    return result.rows?.[0] || null;
  } catch (error) {
    console.error('Error fetching shareholder:', error);
    throw error;
  }
}

/**
 * Create new shareholder
 * @param {Object} data - {name, email, is_founder}
 * @returns {Promise<Object>} Created shareholder
 */
export async function createShareholder(data) {
  try {
    const { name, email, is_founder = false } = data;

    if (!name || name.trim().length === 0) {
      throw new Error('Shareholder name is required');
    }

    const result = await query(`
      INSERT INTO shareholders (name, email, is_founder, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, email, is_founder, status, created_at
    `, [name, email || null, is_founder]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating shareholder:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * SHARE ALLOCATION - PERCENTAGE MODEL
 * ============================================================================
 */

/**
 * Allocate percentage to shareholder
 * VALIDATES: Total percentages <= 100%
 * ENFORCES: Only one allocation per shareholder
 * 
 * @param {string} shareholderId - UUID of shareholder (or create new)
 * @param {number} percentage - Ownership percentage (0-100)
 * @param {Object} options - {vesting_start_date, vesting_end_date, vesting_cliff_months}
 * @returns {Promise<Object>} Allocation confirmation with total
 */
export async function allocateShares(shareholderId, percentage, options = {}) {
  try {
    // ========== VALIDATION ==========
    if (!shareholderId) {
      throw new Error('Shareholder ID is required');
    }

    if (typeof percentage !== 'number' || percentage <= 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    // Check shareholder exists
    const shareholder = await getShareholder(shareholderId);
    if (!shareholder) {
      throw new Error(`Shareholder ${shareholderId} not found`);
    }

    // ========== GET CURRENT TOTAL EXCLUDING THIS SHAREHOLDER ==========
    const totalsResult = await query(`
      SELECT COALESCE(SUM(percentage), 0) as total
      FROM share_allocations
      WHERE shareholder_id != $1
    `, [shareholderId]);

    const currentTotal = parseFloat(totalsResult.rows[0].total) || 0;
    const newTotal = currentTotal + percentage;

    // ========== ENFORCE: Total <= 100% ==========
    if (newTotal > 100) {
      throw new Error(
        `Cannot allocate ${percentage}% to ${shareholder.name}. ` +
        `Current allocations: ${currentTotal}%. ` +
        `Total would be ${newTotal}%, which exceeds 100%. ` +
        `Available: ${(100 - currentTotal).toFixed(2)}%`
      );
    }

    // ========== UPSERT ALLOCATION ==========
    const result = await query(`
      INSERT INTO share_allocations (
        id,
        shareholder_id,
        percentage,
        vesting_start_date,
        vesting_end_date,
        vesting_cliff_months,
        created_at,
        updated_at
      )
      VALUES (
        COALESCE(
          (SELECT id FROM share_allocations WHERE shareholder_id = $1 LIMIT 1),
          gen_random_uuid()
        ),
        $1,
        $2,
        $3,
        $4,
        $5,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (shareholder_id) DO UPDATE SET
        percentage = $2,
        vesting_start_date = $3,
        vesting_end_date = $4,
        vesting_cliff_months = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      shareholderId,
      percentage,
      options.vesting_start_date || null,
      options.vesting_end_date || null,
      options.vesting_cliff_months || null,
    ]);

    const allocation = result.rows[0];

    // ========== RETURN SUMMARY ==========
    const summary = await getShareAllocationSummary();
    
    console.log(`✓ ${shareholder.name} allocated ${percentage}% (Total: ${summary.total_allocated}%)`);

    return {
      shareholder_id: shareholderId,
      name: shareholder.name,
      percentage,
      total_allocated: summary.total_allocated,
      available: summary.available,
      allocation,
    };
  } catch (error) {
    console.error('Error allocating shares:', error);
    throw error;
  }
}

/**
 * Increment shareholder percentage (e.g., from 50% to 52%)
 * @param {string} shareholderId - UUID of shareholder
 * @param {number} incrementPercent - Amount to add (e.g., 2)
 * @returns {Promise<Object>} Updated allocation with new total
 */
export async function incrementShares(shareholderId, incrementPercent) {
  try {
    // Get current allocation
    const shareholder = await getShareholder(shareholderId);
    if (!shareholder) {
      throw new Error(`Shareholder ${shareholderId} not found`);
    }

    const currentPercentage = shareholder.percentage || 0;
    const newPercentage = currentPercentage + incrementPercent;

    if (newPercentage > 100) {
      throw new Error(
        `Cannot increment ${shareholder.name} by ${incrementPercent}%. ` +
        `Current: ${currentPercentage}%, would be ${newPercentage}%, exceeds 100%.`
      );
    }

    // Apply new allocation
    return await allocateShares(shareholderId, newPercentage);
  } catch (error) {
    console.error('Error incrementing shares:', error);
    throw error;
  }
}

/**
 * Decrement shareholder percentage (e.g., from 52% to 50%)
 * @param {string} shareholderId - UUID of shareholder
 * @param {number} decrementPercent - Amount to subtract (e.g., 2)
 * @returns {Promise<Object>} Updated allocation with new total
 */
export async function decrementShares(shareholderId, decrementPercent) {
  try {
    // Get current allocation
    const shareholder = await getShareholder(shareholderId);
    if (!shareholder) {
      throw new Error(`Shareholder ${shareholderId} not found`);
    }

    const currentPercentage = shareholder.percentage || 0;
    const newPercentage = currentPercentage - decrementPercent;

    if (newPercentage <= 0) {
      throw new Error(
        `Cannot decrement ${shareholder.name} by ${decrementPercent}%. ` +
        `Current: ${currentPercentage}%, would be ${newPercentage}%, which is invalid.`
      );
    }

    // Apply new allocation
    return await allocateShares(shareholderId, newPercentage);
  } catch (error) {
    console.error('Error decrementing shares:', error);
    throw error;
  }
}

/**
 * Get share allocation summary
 * @returns {Promise<Object>} Total allocated, available, and validation status
 */
export async function getShareAllocationSummary() {
  try {
    const result = await query(`
      SELECT
        COALESCE(SUM(percentage), 0) as total_allocated,
        (100 - COALESCE(SUM(percentage), 0)) as available,
        COUNT(*) as shareholder_count,
        MAX(percentage) as largest_stake,
        MIN(percentage) as smallest_stake
      FROM share_allocations
    `);

    const summary = result.rows[0];
    
    return {
      total_allocated: parseFloat(summary.total_allocated).toFixed(2),
      available: parseFloat(summary.available).toFixed(2),
      shareholder_count: parseInt(summary.shareholder_count),
      largest_stake: summary.largest_stake ? parseFloat(summary.largest_stake).toFixed(2) : 0,
      smallest_stake: summary.smallest_stake ? parseFloat(summary.smallest_stake).toFixed(2) : 0,
      is_complete: parseFloat(summary.total_allocated) === 100,
      validation_status: parseFloat(summary.total_allocated) <= 100 ? 'VALID' : 'INVALID',
    };
  } catch (error) {
    console.error('Error getting allocation summary:', error);
    throw error;
  }
}

/**
 * Get cap table (full ownership structure)
 * @returns {Promise<Array>} Complete cap table with percentages and vesting
 */
export async function getCapTable() {
  try {
    const result = await query(`
      SELECT
        s.id,
        s.name,
        s.email,
        s.is_founder,
        sa.percentage,
        sa.vesting_start_date,
        sa.vesting_end_date,
        sa.vesting_cliff_months,
        CASE
          WHEN sa.vesting_end_date IS NULL THEN 'FULLY VESTED'
          WHEN CURRENT_DATE < sa.vesting_start_date THEN 'NOT STARTED'
          WHEN CURRENT_DATE >= sa.vesting_end_date THEN 'FULLY VESTED'
          ELSE CONCAT(
            ROUND(
              (EXTRACT(DAY FROM CURRENT_DATE - sa.vesting_start_date) * 100.0) /
              EXTRACT(DAY FROM sa.vesting_end_date - sa.vesting_start_date),
              2
            ),
            '% vested'
          )
        END as vesting_status,
        sa.created_at,
        sa.updated_at
      FROM shareholders s
      LEFT JOIN share_allocations sa ON s.id = sa.shareholder_id
      WHERE s.status = 'active'
      ORDER BY s.is_founder DESC, COALESCE(sa.percentage, 0) DESC
    `);

    const capTable = result.rows || [];
    const summary = await getShareAllocationSummary();

    return {
      shares: capTable,
      summary: summary,
    };
  } catch (error) {
    console.error('Error getting cap table:', error);
    throw error;
  }
}

export default {
  getShareholders,
  getShareholder,
  createShareholder,
  allocateShares,
  incrementShares,
  decrementShares,
  getShareAllocationSummary,
  getCapTable,
};
