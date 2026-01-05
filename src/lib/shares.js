/**
 * Comprehensive Share Management System
 * 
 * Handles two-layer share model (authorized vs issued), valuations, vesting,
 * buybacks, and complete cap table management with audit logging.
 */

import { query } from './db.js';

/**
 * ============================================================================
 * SHARES CONFIGURATION MANAGEMENT
 * ============================================================================
 */

/**
 * Get or initialize company shares configuration
 * @returns {Promise<Object>} Shares config with authorized_shares, issued_shares, unissued_shares
 */
export async function getSharesConfiguration() {
  try {
    let result = await query('SELECT * FROM shares_config LIMIT 1');
    
    if (result.rowCount === 0) {
      // Initialize default configuration
      result = await query(`
        INSERT INTO shares_config (authorized_shares, par_value, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [1000000, 1.00, 'Default company shares configuration']);
    }
    
    const config = result.rows[0];
    return {
      id: config.id,
      authorized_shares: parseInt(config.authorized_shares),
      issued_shares: parseInt(config.issued_shares),
      unissued_shares: parseInt(config.authorized_shares) - parseInt(config.issued_shares),
      par_value: parseFloat(config.par_value || 0),
      description: config.description,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };
  } catch (error) {
    console.error('Error getting shares configuration:', error);
    throw error;
  }
}

/**
 * Update authorized shares (company-wide setting)
 * @param {number} newAuthorizedShares - New authorized shares count
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateAuthorizedShares(newAuthorizedShares) {
  try {
    if (newAuthorizedShares <= 0) {
      throw new Error('Authorized shares must be positive');
    }

    const config = await getSharesConfiguration();
    if (newAuthorizedShares < config.issued_shares) {
      throw new Error(
        `Cannot reduce authorized shares below issued shares (${config.issued_shares})`
      );
    }

    const result = await query(`
      UPDATE shares_config
      SET authorized_shares = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM shares_config LIMIT 1)
      RETURNING *
    `, [newAuthorizedShares]);

    const updated = result.rows[0];
    return {
      authorized_shares: parseInt(updated.authorized_shares),
      issued_shares: parseInt(updated.issued_shares),
      unissued_shares: parseInt(updated.authorized_shares) - parseInt(updated.issued_shares),
    };
  } catch (error) {
    console.error('Error updating authorized shares:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * VALUATION ENGINE
 * ============================================================================
 */

/**
 * Record a valuation round/snapshot
 * @param {Object} valuation - { pre_money, investment_amount, round_name, investor_name }
 * @returns {Promise<Object>} Valuation record with calculated post_money and share_price
 */
export async function recordValuationRound(valuation) {
  try {
    const {
      pre_money_valuation,
      investment_amount,
      round_name,
      investor_name,
      notes,
      created_by_id,
    } = valuation;

    if (!pre_money_valuation || !investment_amount) {
      throw new Error('pre_money_valuation and investment_amount are required');
    }

    if (pre_money_valuation <= 0 || investment_amount <= 0) {
      throw new Error('Valuations and investment must be positive');
    }

    const config = await getSharesConfiguration();
    
    // Calculate post-money valuation
    const post_money_valuation = pre_money_valuation + investment_amount;
    
    // Calculate share price
    const share_price = config.issued_shares > 0 
      ? pre_money_valuation / config.issued_shares 
      : 0;
    
    // Calculate shares to issue
    const shares_to_issue = Math.floor(investment_amount / share_price);

    const result = await query(`
      INSERT INTO valuation_snapshots (
        shares_config_id, pre_money_valuation, investment_amount, 
        post_money_valuation, share_price, issued_shares_after,
        round_name, investor_name, notes, created_by_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      config.id,
      pre_money_valuation,
      investment_amount,
      post_money_valuation,
      share_price,
      config.issued_shares + shares_to_issue,
      round_name || null,
      investor_name || null,
      notes || null,
      created_by_id || null,
    ]);

    const snapshot = result.rows[0];
    return {
      id: snapshot.id,
      pre_money_valuation: parseFloat(snapshot.pre_money_valuation),
      investment_amount: parseFloat(snapshot.investment_amount),
      post_money_valuation: parseFloat(snapshot.post_money_valuation),
      share_price: parseFloat(snapshot.share_price),
      shares_to_issue: shares_to_issue,
      issued_shares_after: parseInt(snapshot.issued_shares_after),
      round_name: snapshot.round_name,
      created_at: snapshot.created_at,
    };
  } catch (error) {
    console.error('Error recording valuation round:', error);
    throw error;
  }
}

/**
 * Get current company valuation
 * @returns {Promise<Object>} Current valuation metrics
 */
export async function getCurrentValuation() {
  try {
    const result = await query(`
      SELECT * FROM valuation_snapshots 
      ORDER BY created_at DESC LIMIT 1
    `);

    if (result.rowCount === 0) {
      return {
        pre_money_valuation: 0,
        post_money_valuation: 0,
        share_price: 0,
        last_round: null,
      };
    }

    const latest = result.rows[0];
    return {
      pre_money_valuation: parseFloat(latest.pre_money_valuation),
      post_money_valuation: parseFloat(latest.post_money_valuation),
      share_price: parseFloat(latest.share_price),
      last_round: latest.round_name,
      investor: latest.investor_name,
      created_at: latest.created_at,
    };
  } catch (error) {
    console.error('Error getting current valuation:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * VESTING CALCULATIONS
 * ============================================================================
 */

/**
 * Calculate vested shares for a shareholder with GRANTED equity
 * @param {string} shareholderId - Shareholder ID
 * @returns {Promise<Object>} { total_granted, vested_shares, unvested_shares, vesting_percentage }
 */
export async function calculateVestedShares(shareholderId) {
  try {
    const result = await query(`
      SELECT 
        shares_owned,
        equity_type,
        vesting_start_date,
        vesting_end_date,
        vesting_percentage,
        vested_shares,
        unvested_shares
      FROM shareholdings_with_vesting
      WHERE shareholder_id = $1
    `, [shareholderId]);

    if (result.rowCount === 0) {
      throw new Error('Shareholder not found');
    }

    const row = result.rows[0];
    
    return {
      total_shares: parseInt(row.shares_owned),
      equity_type: row.equity_type,
      vested_shares: parseInt(row.vested_shares),
      unvested_shares: parseInt(row.unvested_shares),
      vesting_start_date: row.vesting_start_date,
      vesting_end_date: row.vesting_end_date,
      vesting_percentage: parseFloat(row.vesting_percentage || 100),
      is_fully_vested: parseInt(row.vested_shares) === parseInt(row.shares_owned),
    };
  } catch (error) {
    console.error('Error calculating vested shares:', error);
    throw error;
  }
}

/**
 * Get vesting progress (for UI timeline display)
 * @param {string} shareholderId - Shareholder ID
 * @returns {Promise<Object>} Vesting progress with timeline
 */
export async function getVestingProgress(shareholderId) {
  try {
    const vesting = await calculateVestedShares(shareholderId);
    
    if (!vesting.vesting_start_date || !vesting.vesting_end_date) {
      return {
        ...vesting,
        progress_percentage: 100,
        time_elapsed_days: 0,
        total_vesting_days: 0,
        remaining_days: 0,
        status: 'not_applicable',
      };
    }

    const today = new Date();
    const startDate = new Date(vesting.vesting_start_date);
    const endDate = new Date(vesting.vesting_end_date);
    
    const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    
    const progressPercentage = totalDays > 0 
      ? Math.min(100, Math.floor((elapsedDays / totalDays) * 100))
      : 100;

    return {
      ...vesting,
      progress_percentage: progressPercentage,
      time_elapsed_days: Math.max(0, elapsedDays),
      total_vesting_days: totalDays,
      remaining_days: remainingDays,
      status: remainingDays === 0 ? 'fully_vested' : 'vesting',
    };
  } catch (error) {
    console.error('Error getting vesting progress:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * SHARE ISSUANCE
 * ============================================================================
 */

/**
 * Issue new shares to a shareholder
 * @param {Object} issuance - { to_shareholder_id, shares_amount, equity_type, valuation_snapshot_id }
 * @returns {Promise<Object>} Updated shareholding and config
 */
export async function issueNewShares(issuance) {
  try {
    const {
      to_shareholder_id,
      shares_amount,
      equity_type = 'GRANTED',
      vesting_start_date = null,
      vesting_end_date = null,
      vesting_percentage = 100,
      purchase_price = null,
      valuation_snapshot_id = null,
      reason = null,
    } = issuance;

    if (!to_shareholder_id || !shares_amount || shares_amount <= 0) {
      throw new Error('Invalid issuance parameters');
    }

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      throw new Error('Invalid equity_type');
    }

    // Check GRANTED equity has vesting end date
    if (equity_type === 'GRANTED' && !vesting_end_date) {
      throw new Error('GRANTED equity must have vesting_end_date');
    }

    // Get config
    const config = await getSharesConfiguration();

    // Validate capacity
    if (shares_amount > config.unissued_shares) {
      throw new Error(
        `Cannot issue ${shares_amount} shares. Only ${config.unissued_shares} unissued shares available.`
      );
    }

    // Begin transaction
    await query('BEGIN');

    try {
      // Update issued shares count
      await query(`
        UPDATE shares_config
        SET issued_shares = issued_shares + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM shares_config LIMIT 1)
      `, [shares_amount]);

      // Insert or update shareholding
      const upsertResult = await query(`
        INSERT INTO shareholdings (
          shareholder_id, shares_owned, equity_type,
          vesting_start_date, vesting_end_date, vesting_percentage,
          acquisition_date, purchase_price, status,
          valuation_snapshot_id
        )
        SELECT $1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, 'active', $8
        ON CONFLICT (shareholder_id) DO UPDATE
        SET shares_owned = shareholdings.shares_owned + $2,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        to_shareholder_id,
        shares_amount,
        equity_type,
        vesting_start_date,
        vesting_end_date,
        vesting_percentage,
        purchase_price,
        valuation_snapshot_id,
      ]);

      // Log transaction
      await query(`
        INSERT INTO share_transactions (
          transaction_type, to_shareholder_id, shares_amount,
          price_per_share, equity_type, reason
        )
        VALUES ('issuance', $1, $2, $3, $4, $5)
      `, [
        to_shareholder_id,
        shares_amount,
        purchase_price,
        equity_type,
        reason,
      ]);

      await query('COMMIT');

      return {
        success: true,
        shareholding: upsertResult.rows[0],
        config: await getSharesConfiguration(),
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error issuing shares:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * SHARE TRANSFERS
 * ============================================================================
 */

/**
 * Transfer shares between shareholders
 * @param {Object} transfer - { from_id, to_id, shares_amount, price_per_share, reason }
 * @returns {Promise<Object>} Transfer result
 */
export async function transferShares(transfer) {
  try {
    const {
      from_shareholder_id,
      to_shareholder_id,
      shares_amount,
      price_per_share = null,
      reason = null,
    } = transfer;

    if (!from_shareholder_id || !to_shareholder_id || !shares_amount || shares_amount <= 0) {
      throw new Error('Invalid transfer parameters');
    }

    // Verify sender has enough shares
    const senderResult = await query(`
      SELECT shares_owned, equity_type FROM shareholdings
      WHERE shareholder_id = $1 AND status = 'active'
    `, [from_shareholder_id]);

    if (senderResult.rowCount === 0) {
      throw new Error('Sender not found or inactive');
    }

    const sender = senderResult.rows[0];
    const senderShares = parseInt(sender.shares_owned);

    if (senderShares < shares_amount) {
      throw new Error(`Insufficient shares. Sender has ${senderShares}, trying to transfer ${shares_amount}`);
    }

    // Begin transaction
    await query('BEGIN');

    try {
      // Reduce sender shares
      await query(`
        UPDATE shareholdings
        SET shares_owned = shares_owned - $1, updated_at = CURRENT_TIMESTAMP
        WHERE shareholder_id = $2
      `, [shares_amount, from_shareholder_id]);

      // Increase recipient shares
      const recipientResult = await query(`
        INSERT INTO shareholdings (
          shareholder_id, shares_owned, equity_type,
          status, acquisition_date
        )
        SELECT $1, $2, $3, 'active', CURRENT_DATE
        ON CONFLICT (shareholder_id) DO UPDATE
        SET shares_owned = shareholdings.shares_owned + $2,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        to_shareholder_id,
        shares_amount,
        sender.equity_type,
      ]);

      // Log transaction
      await query(`
        INSERT INTO share_transactions (
          transaction_type, from_shareholder_id, to_shareholder_id,
          shares_amount, price_per_share, equity_type, reason
        )
        VALUES ('transfer', $1, $2, $3, $4, $5, $6)
      `, [
        from_shareholder_id,
        to_shareholder_id,
        shares_amount,
        price_per_share,
        sender.equity_type,
        reason,
      ]);

      await query('COMMIT');

      return {
        success: true,
        message: `Transferred ${shares_amount} shares from sender to recipient`,
        from_new_balance: senderShares - shares_amount,
        to_new_balance: parseInt(recipientResult.rows[0].shares_owned),
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error transferring shares:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * BUYBACK SYSTEM
 * ============================================================================
 */

/**
 * Execute share buyback
 * @param {Object} buyback - { shareholder_id, shares_repurchased, buyback_price_per_share, reason }
 * @returns {Promise<Object>} Buyback result
 */
export async function executeBuyback(buyback) {
  try {
    const {
      shareholder_id,
      shares_repurchased,
      buyback_price_per_share,
      reason = null,
      approved_by_id = null,
    } = buyback;

    if (!shareholder_id || !shares_repurchased || shares_repurchased <= 0) {
      throw new Error('Invalid buyback parameters');
    }

    // Verify shareholder has enough shares
    const shareholderResult = await query(`
      SELECT shares_owned FROM shareholdings
      WHERE shareholder_id = $1 AND status = 'active'
    `, [shareholder_id]);

    if (shareholderResult.rowCount === 0) {
      throw new Error('Shareholder not found');
    }

    const currentShares = parseInt(shareholderResult.rows[0].shares_owned);

    if (currentShares < shares_repurchased) {
      throw new Error(
        `Shareholder has ${currentShares} shares, trying to buy back ${shares_repurchased}`
      );
    }

    const totalValue = shares_repurchased * (buyback_price_per_share || 0);

    // Begin transaction
    await query('BEGIN');

    try {
      // Record buyback
      const buybackResult = await query(`
        INSERT INTO share_buybacks (
          shareholder_id, shares_repurchased, buyback_price_per_share,
          total_repurchase_value, reason, approved_by_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'completed')
        RETURNING *
      `, [
        shareholder_id,
        shares_repurchased,
        buyback_price_per_share,
        totalValue,
        reason,
        approved_by_id,
      ]);

      // Reduce shareholder shares
      await query(`
        UPDATE shareholdings
        SET shares_owned = shares_owned - $1, updated_at = CURRENT_TIMESTAMP
        WHERE shareholder_id = $2
      `, [shares_repurchased, shareholder_id]);

      // Reduce issued shares
      await query(`
        UPDATE shares_config
        SET issued_shares = issued_shares - $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM shares_config LIMIT 1)
      `, [shares_repurchased]);

      // Log transaction
      await query(`
        INSERT INTO share_transactions (
          transaction_type, from_shareholder_id, shares_amount,
          price_per_share, reason, reference_id
        )
        VALUES ('buyback', $1, $2, $3, $4, $5)
      `, [
        shareholder_id,
        shares_repurchased,
        buyback_price_per_share,
        reason,
        buybackResult.rows[0].id,
      ]);

      await query('COMMIT');

      return {
        success: true,
        message: `Successfully repurchased ${shares_repurchased} shares`,
        new_balance: currentShares - shares_repurchased,
        total_value: totalValue,
        config: await getSharesConfiguration(),
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error executing buyback:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * CAP TABLE WITH VESTING
 * ============================================================================
 */

/**
 * Get complete cap table with vesting information
 * @returns {Promise<Array>} Cap table with ownership % and vesting details
 */
export async function getCapTableWithVesting() {
  try {
    const config = await getSharesConfiguration();

    const result = await query(`
      SELECT 
        sh.id,
        sh.shareholder_id,
        sh.shareholder_name,
        sh.shareholder_email,
        sh.shares_owned,
        sh.equity_type,
        sh.vesting_start_date,
        sh.vesting_end_date,
        sh.vesting_percentage,
        shv.vested_shares,
        shv.unvested_shares,
        sh.holder_type,
        sh.acquisition_price,
        sh.investment_total,
        sh.status,
        ROUND((sh.shares_owned::FLOAT / $1 * 100)::NUMERIC, 2) as ownership_percentage,
        ROUND((shv.vested_shares::FLOAT / $1 * 100)::NUMERIC, 2) as vested_ownership_percentage
      FROM shareholdings sh
      LEFT JOIN shareholdings_with_vesting shv ON sh.id = shv.id
      WHERE sh.status = 'active'
      ORDER BY sh.shares_owned DESC
    `, [config.issued_shares || 1]);

    return result.rows.map(row => ({
      ...row,
      shares_owned: parseInt(row.shares_owned),
      vested_shares: parseInt(row.vested_shares || 0),
      unvested_shares: parseInt(row.unvested_shares || 0),
      ownership_percentage: parseFloat(row.ownership_percentage),
      vested_ownership_percentage: parseFloat(row.vested_ownership_percentage),
      investment_total: parseFloat(row.investment_total || 0),
    }));
  } catch (error) {
    console.error('Error getting cap table with vesting:', error);
    throw error;
  }
}

// Legacy functions for backward compatibility
export function calculateSharePrice(strategicValue, totalShares) {
  if (!totalShares || totalShares <= 0) return 0;
  return parseFloat((strategicValue / totalShares).toFixed(4));
}

export function calculateShareValue(sharePrice, shareQuantity) {
  return parseFloat((sharePrice * shareQuantity).toFixed(2));
}

export function calculateOwnershipPercentage(sharesOwned, totalShares) {
  if (!totalShares || totalShares <= 0) return 0;
  return parseFloat(((sharesOwned / totalShares) * 100).toFixed(2));
}

export default {
  getSharesConfiguration,
  updateAuthorizedShares,
  recordValuationRound,
  getCurrentValuation,
  calculateVestedShares,
  getVestingProgress,
  issueNewShares,
  transferShares,
  executeBuyback,
  getCapTableWithVesting,
  // Legacy exports
  calculateSharePrice,
  calculateShareValue,
  calculateOwnershipPercentage,
};
