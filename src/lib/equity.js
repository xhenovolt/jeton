/**
 * Corporate Equity System Library
 * 
 * Implements URSB-compliant share management with:
 * - Authorized Shares (maximum allowable)
 * - Issued Shares (officially created)
 * - Allocated Shares (owned by shareholders)
 * - Share Transfers (ownership changes without dilution)
 * - Share Issuance (new share creation with dilution)
 */

import { query } from '@/lib/db.js';

// ============================================================================
// SHARE CONFIGURATION OPERATIONS
// ============================================================================

/**
 * Get current share configuration (authorized, issued, allocated)
 * @returns {Promise<Object>} Share configuration with all metrics
 */
export async function getShareConfiguration() {
  try {
    const configResult = await query(`
      SELECT
        id,
        authorized_shares,
        issued_shares,
        par_value,
        class_type,
        status,
        created_at,
        updated_at
      FROM shares_config
      LIMIT 1
    `);

    if (configResult.rowCount === 0) {
      // Return default if not configured
      return {
        id: null,
        authorized_shares: 10000000,
        issued_shares: 1000000,
        par_value: 1.0,
        class_type: 'Common',
        status: 'active',
        unissued_shares: 9000000,
        allocated_shares: 0,
      };
    }

    const config = configResult.rows[0];

    // Get allocated shares
    const allocatedResult = await query(`
      SELECT COALESCE(SUM(shares_owned), 0) as total_allocated
      FROM shareholdings
      WHERE status IN ('active', 'vesting')
    `);

    const allocatedShares = parseInt(allocatedResult.rows[0]?.total_allocated || 0);

    return {
      ...config,
      id: config.id,
      authorized_shares: parseInt(config.authorized_shares),
      issued_shares: parseInt(config.issued_shares),
      par_value: parseFloat(config.par_value),
      unissued_shares: parseInt(config.authorized_shares) - parseInt(config.issued_shares),
      allocated_shares: allocatedShares,
      unallocated_issued: parseInt(config.issued_shares) - allocatedShares,
      allocation_percentage: (
        (allocatedShares / parseInt(config.issued_shares)) * 100
      ).toFixed(2),
    };
  } catch (error) {
    console.error('Error getting share configuration:', error);
    throw error;
  }
}

/**
 * Update share configuration (authorized/issued shares)
 * @param {Object} updates - {authorized_shares, issued_shares, par_value, class_type}
 * @param {string} reason - Reason for update (for audit trail)
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateShareConfiguration(updates, reason) {
  try {
    const current = await getShareConfiguration();

    // Validate constraints
    if (updates.authorized_shares && updates.authorized_shares < current.issued_shares) {
      throw new Error('Cannot reduce authorized shares below issued shares');
    }

    if (updates.issued_shares && updates.issued_shares < current.allocated_shares) {
      throw new Error('Cannot reduce issued shares below allocated shares');
    }

    const result = await query(`
      UPDATE shares_config
      SET
        authorized_shares = COALESCE($1, authorized_shares),
        issued_shares = COALESCE($2, issued_shares),
        par_value = COALESCE($3, par_value),
        class_type = COALESCE($4, class_type),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM shares_config LIMIT 1)
      RETURNING *
    `, [
      updates.authorized_shares || null,
      updates.issued_shares || null,
      updates.par_value || null,
      updates.class_type || null,
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error updating share configuration:', error);
    throw error;
  }
}

// ============================================================================
// SHAREHOLDING OPERATIONS
// ============================================================================

/**
 * Get all current shareholdings (cap table)
 * @param {Object} options - {status: 'active', holder_type: 'founder'}
 * @returns {Promise<Array>} List of shareholdings with ownership %
 */
export async function getCapTable(options = {}) {
  try {
    const statusFilter = options.status || 'active';
    const config = await getShareConfiguration();

    const result = await query(`
      SELECT
        id,
        shareholder_id,
        shareholder_name,
        shareholder_email,
        shares_owned,
        vested_shares,
        (shares_owned - COALESCE(vested_shares, 0)) as unvested_shares,
        share_class,
        equity_type,
        holder_type,
        acquisition_date,
        acquisition_price,
        investment_total,
        original_ownership_percentage,
        current_ownership_percentage,
        status,
        created_at,
        updated_at
      FROM shareholdings
      WHERE status IN ('active', 'vesting')
      ${options.holder_type ? "AND holder_type = $1" : ""}
      ORDER BY shares_owned DESC
    `, options.holder_type ? [options.holder_type] : []);

    // Calculate current percentages
    const issuedShares = config.issued_shares;
    return result.rows.map(row => ({
      ...row,
      shares_owned: parseInt(row.shares_owned),
      vested_shares: parseInt(row.vested_shares),
      unvested_shares: parseInt(row.unvested_shares),
      equity_type: row.equity_type || 'PURCHASED',
      current_ownership_percentage: (
        (parseInt(row.shares_owned) / issuedShares) * 100
      ).toFixed(2),
      acquisition_price: parseFloat(row.acquisition_price || 0),
      investment_total: parseFloat(row.investment_total || 0),
    }));
  } catch (error) {
    console.error('Error getting cap table:', error);
    throw error;
  }
}

/**
 * Get shareholding for specific shareholder
 * @param {string} shareholderId - User ID of shareholder
 * @returns {Promise<Object>} Shareholding details
 */
export async function getShareholder(shareholderId) {
  try {
    const result = await query(`
      SELECT
        id,
        shareholder_id,
        shareholder_name,
        shareholder_email,
        shares_owned,
        vested_shares,
        share_class,
        equity_type,
        holder_type,
        acquisition_date,
        acquisition_price,
        investment_total,
        original_ownership_percentage,
        current_ownership_percentage,
        vesting_start_date,
        vesting_end_date,
        vesting_schedule,
        status,
        created_at,
        updated_at
      FROM shareholdings
      WHERE shareholder_id = $1
    `, [shareholderId]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      shares_owned: parseInt(row.shares_owned),
      vested_shares: parseInt(row.vested_shares),
      equity_type: row.equity_type || 'PURCHASED',
      acquisition_price: parseFloat(row.acquisition_price || 0),
      investment_total: parseFloat(row.investment_total || 0),
    };
  } catch (error) {
    console.error('Error getting shareholder:', error);
    throw error;
  }
}

/**
 * Add new shareholder
 * @param {Object} shareholder - {shareholder_id, name, email, shares_owned, holder_type, equity_type, acquisition_price}
 * @returns {Promise<Object>} Created shareholding
 */
export async function addShareholder(shareholder) {
  try {
    const {
      shareholder_id,
      shareholder_name,
      shareholder_email,
      shares_owned,
      holder_type,
      equity_type = 'PURCHASED',
      acquisition_price,
      share_class = 'Common',
    } = shareholder;

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      throw new Error('Invalid equity_type. Must be PURCHASED or GRANTED.');
    }

    const config = await getShareConfiguration();

    // Validate total allocated won't exceed issued
    const capTable = await getCapTable();
    const totalAllocated = capTable.reduce((sum, s) => sum + s.shares_owned, 0);

    if (totalAllocated + shares_owned > config.issued_shares) {
      throw new Error(
        `Cannot allocate ${shares_owned} shares. Only ${config.issued_shares - totalAllocated} unallocated shares available.`
      );
    }

    const result = await query(`
      INSERT INTO shareholdings (
        shareholder_id, shareholder_name, shareholder_email,
        shares_owned, share_class, holder_type, equity_type,
        acquisition_date, acquisition_price, investment_total,
        status, original_ownership_percentage, current_ownership_percentage
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, $8, $9, 'active', $10, $10)
      RETURNING *
    `, [
      shareholder_id,
      shareholder_name,
      shareholder_email,
      shares_owned,
      share_class,
      holder_type,
      equity_type,
      acquisition_price || null,
      shares_owned * (acquisition_price || 0),
      ((shares_owned / config.issued_shares) * 100).toFixed(2),
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error adding shareholder:', error);
    throw error;
  }
}

// ============================================================================
// SHARE TRANSFER OPERATIONS (NO DILUTION)
// ============================================================================

/**
 * Transfer shares from one shareholder to another (no dilution)
 * @param {Object} transfer - {from_id, to_id, shares, price, type, equity_type, reason}
 * @returns {Promise<Object>} Transfer result with new balances
 */
export async function executeShareTransfer(transfer) {
  try {
    const {
      from_shareholder_id,
      to_shareholder_id,
      shares_transferred,
      transfer_price_per_share,
      transfer_type = 'secondary-sale',
      equity_type = 'PURCHASED',
      reason,
    } = transfer;

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      throw new Error('Invalid equity_type. Must be PURCHASED or GRANTED.');
    }

    if (!from_shareholder_id || !to_shareholder_id || !shares_transferred) {
      throw new Error('Missing required transfer parameters');
    }

    if (shares_transferred <= 0) {
      throw new Error('Shares transferred must be positive');
    }

    // Verify sender has enough shares
    const senderResult = await query(`
      SELECT shares_owned FROM shareholdings
      WHERE shareholder_id = $1 AND status = 'active'
    `, [from_shareholder_id]);

    if (senderResult.rowCount === 0) {
      throw new Error('Sender not found or inactive');
    }

    const senderShares = parseInt(senderResult.rows[0].shares_owned);
    if (senderShares < shares_transferred) {
      throw new Error(
        `Insufficient shares. Sender has ${senderShares}, trying to transfer ${shares_transferred}`
      );
    }

    // Execute transfer in transaction
    await query('BEGIN');

    try {
      // Update sender
      await query(`
        UPDATE shareholdings
        SET shares_owned = shares_owned - $1, updated_at = CURRENT_TIMESTAMP
        WHERE shareholder_id = $2
      `, [shares_transferred, from_shareholder_id]);

      // Update or create recipient
      await query(`
        INSERT INTO shareholdings (
          shareholder_id, shareholder_name, shareholder_email,
          shares_owned, acquisition_date, acquisition_price,
          investment_total, share_class, holder_type, equity_type, status
        )
        SELECT $1, u.full_name, u.email, $2,
               CURRENT_DATE, $3, $4, 'Common', 'investor', $5, 'active'
        FROM users u WHERE u.id = $1
        ON CONFLICT (shareholder_id) DO UPDATE
        SET shares_owned = shareholdings.shares_owned + $2,
            updated_at = CURRENT_TIMESTAMP
      `, [
        to_shareholder_id,
        shares_transferred,
        transfer_price_per_share || null,
        shares_transferred * (transfer_price_per_share || 0),
        equity_type,
      ]);

      // Record transfer
      await query(`
        INSERT INTO share_transfers (
          from_shareholder_id, to_shareholder_id, shares_transferred,
          transfer_price_per_share, transfer_total, transfer_type,
          transfer_date, transfer_status, equity_type, reason, created_by_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'completed', $7, $8, $1)
      `, [
        from_shareholder_id,
        to_shareholder_id,
        shares_transferred,
        transfer_price_per_share || null,
        (shares_transferred * (transfer_price_per_share || 0)) || null,
        transfer_type,
        equity_type,
        reason || null,
      ]);

      await query('COMMIT');

      // Get updated balances
      const fromResult = await query(`
        SELECT shares_owned FROM shareholdings WHERE shareholder_id = $1
      `, [from_shareholder_id]);

      const toResult = await query(`
        SELECT shares_owned FROM shareholdings WHERE shareholder_id = $1
      `, [to_shareholder_id]);

      return {
        success: true,
        message: `Successfully transferred ${shares_transferred} shares`,
        from_new_balance: parseInt(fromResult.rows[0].shares_owned),
        to_new_balance: parseInt(toResult.rows[0].shares_owned),
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error executing share transfer:', error);
    throw error;
  }
}

// ============================================================================
// SHARE ISSUANCE OPERATIONS (WITH DILUTION)
// ============================================================================

/**
 * Propose new share issuance (dilution event)
 * @param {Object} issuance - {shares_issued, issued_at_price, recipient_id, reason, type}
 * @returns {Promise<Object>} Issuance proposal
 */
export async function proposeShareIssuance(issuance) {
  try {
    const {
      shares_issued,
      issued_at_price,
      recipient_id,
      recipient_type,
      issuance_reason,
      issuance_type = 'equity',
      equity_type = 'GRANTED',
      created_by_id,
    } = issuance;

    if (!shares_issued || !created_by_id) {
      throw new Error('Missing required issuance parameters');
    }

    if (shares_issued <= 0) {
      throw new Error('Shares issued must be positive');
    }

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      throw new Error('Invalid equity_type. Must be PURCHASED or GRANTED.');
    }

    const config = await getShareConfiguration();

    // Validate we have authorized capacity
    const availableShares = config.unissued_shares;
    if (shares_issued > availableShares) {
      throw new Error(
        `Cannot issue ${shares_issued} shares. Only ${availableShares} authorized shares available.`
      );
    }

    // Calculate dilution impact
    const capTable = await getCapTable();
    const currentTotalIssued = config.issued_shares;
    const newTotalIssued = currentTotalIssued + shares_issued;
    const dilutionPercentage = ((shares_issued / newTotalIssued) * 100).toFixed(2);

    const result = await query(`
      INSERT INTO share_issuances (
        shares_issued, issued_at_price, recipient_id, recipient_type,
        issuance_reason, issuance_type, equity_type, approval_status,
        previous_issued_shares, ownership_dilution_impact,
        created_by_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      shares_issued,
      issued_at_price || null,
      recipient_id || null,
      recipient_type || null,
      issuance_reason || null,
      issuance_type,
      equity_type,
      currentTotalIssued,
      dilutionPercentage,
      created_by_id,
    ]);

    return {
      success: true,
      issuance: result.rows[0],
      dilution_warning: `⚠️ Issuing ${shares_issued} new shares will dilute existing shareholders by ${dilutionPercentage}%`,
      new_issued_total: newTotalIssued,
      requires_confirmation: true,
    };
  } catch (error) {
    console.error('Error proposing share issuance:', error);
    throw error;
  }
}

/**
 * Approve and execute share issuance
 * @param {string} issuanceId - ID of proposed issuance
 * @param {string} approvedById - User ID of approver
 * @returns {Promise<Object>} Executed issuance
 */
export async function executeShareIssuance(issuanceId, approvedById) {
  try {
    // Get issuance proposal
    const issuanceResult = await query(`
      SELECT * FROM share_issuances WHERE id = $1
    `, [issuanceId]);

    if (issuanceResult.rowCount === 0) {
      throw new Error('Issuance not found');
    }

    const issuance = issuanceResult.rows[0];

    if (issuance.approval_status !== 'pending') {
      throw new Error(`Cannot execute issuance with status: ${issuance.approval_status}`);
    }

    // Verify authorized capacity still available
    const config = await getShareConfiguration();
    if (issuance.shares_issued > config.unissued_shares) {
      throw new Error('Insufficient authorized shares available');
    }

    await query('BEGIN');

    try {
      // Update shares config - increase issued shares
      await query(`
        UPDATE shares_config
        SET issued_shares = issued_shares + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM shares_config LIMIT 1)
      `, [issuance.shares_issued]);

      // If recipient specified, allocate shares to them
      if (issuance.recipient_id) {
        const equityType = issuance.equity_type && ['PURCHASED', 'GRANTED'].includes(issuance.equity_type)
          ? issuance.equity_type
          : 'GRANTED';

        await query(`
          INSERT INTO shareholdings (
            shareholder_id, shareholder_name, shareholder_email,
            shares_owned, share_class, holder_type, equity_type,
            acquisition_date, acquisition_price, status
          )
          SELECT $1, u.full_name, u.email, $2,
                 'Common', $3, $5, CURRENT_DATE, $4, 'active'
          FROM users u WHERE u.id = $1
          ON CONFLICT (shareholder_id) DO UPDATE
          SET shares_owned = shareholdings.shares_owned + $2
        `, [
          issuance.recipient_id,
          issuance.shares_issued,
          issuance.recipient_type || 'investor',
          issuance.issued_at_price || null,
          equityType,
        ]);
      }

      // Record price history
      await query(`
        INSERT INTO share_price_history (
          date, closing_price, company_valuation, issued_shares,
          event_type, event_id
        )
        VALUES (CURRENT_DATE, $1, $2, $3, 'issuance', $4)
      `, [
        issuance.issued_at_price || 0,
        issuance.issued_at_price ? (issuance.issued_at_price * issuance.shares_issued) : null,
        config.issued_shares + issuance.shares_issued,
        issuanceId,
      ]);

      // Update issuance status
      await query(`
        UPDATE share_issuances
        SET approval_status = 'executed',
            approved_by_id = $1,
            approved_at = CURRENT_TIMESTAMP,
            issued_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [approvedById, issuanceId]);

      await query('COMMIT');

      return {
        success: true,
        message: `Successfully issued ${issuance.shares_issued} new shares`,
        new_issued_total: config.issued_shares + issuance.shares_issued,
        dilution_impact: `${issuance.ownership_dilution_impact}%`,
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error executing share issuance:', error);
    throw error;
  }
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate per-share value based on company valuation
 * @param {number} companyValuation - Total company value
 * @param {number} issuedShares - Number of issued shares
 * @returns {number} Value per share
 */
export function calculateSharePrice(companyValuation, issuedShares) {
  if (!issuedShares || issuedShares <= 0) return 0;
  return parseFloat((companyValuation / issuedShares).toFixed(4));
}

/**
 * Calculate ownership percentage
 * @param {number} sharesOwned - Shares owned by shareholder
 * @param {number} totalIssuedShares - Total issued shares
 * @returns {number} Ownership percentage
 */
export function calculateOwnershipPercentage(sharesOwned, totalIssuedShares) {
  if (!totalIssuedShares || totalIssuedShares <= 0) return 0;
  return parseFloat(((sharesOwned / totalIssuedShares) * 100).toFixed(2));
}

/**
 * Calculate shareholder value
 * @param {number} sharesOwned - Shares owned
 * @param {number} sharePrice - Price per share
 * @returns {number} Total value
 */
export function calculateShareholderValue(sharesOwned, sharePrice) {
  return parseFloat((sharesOwned * sharePrice).toFixed(2));
}

/**
 * Get pending issuance count for founder approval
 * @returns {Promise<number>} Count of pending issuances
 */
export async function getPendingIssuanceCount() {
  try {
    const result = await query(`
      SELECT COUNT(*) as count FROM share_issuances
      WHERE approval_status = 'pending'
    `);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting pending issuance count:', error);
    return 0;
  }
}

export default {
  // Configuration
  getShareConfiguration,
  updateShareConfiguration,

  // Cap Table
  getCapTable,
  getShareholder,
  addShareholder,

  // Transfers
  executeShareTransfer,

  // Issuance
  proposeShareIssuance,
  executeShareIssuance,

  // Helpers
  calculateSharePrice,
  calculateOwnershipPercentage,
  calculateShareholderValue,
  getPendingIssuanceCount,
};
