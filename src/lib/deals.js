/**
 * Deal Database Operations
 * CRUD operations and valuation calculations for deals
 */

import { query } from './db.js';

/**
 * Get all deals
 * @returns {Promise<Array>} Array of deals
 */
export async function getDeals() {
  try {
    const result = await query(
      `SELECT * FROM deals ORDER BY created_at DESC`
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error fetching deals:', error);
    throw error;
  }
}

/**
 * Get deals by stage
 * @param {string} stage - Pipeline stage
 * @returns {Promise<Array>} Array of deals in that stage
 */
export async function getDealsByStage(stage) {
  try {
    const result = await query(
      `SELECT * FROM deals WHERE stage = $1 ORDER BY created_at DESC`,
      [stage]
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error fetching deals by stage:', error);
    throw error;
  }
}

/**
 * Get single deal by ID
 * @param {string} id - Deal UUID
 * @returns {Promise<Object>} Deal object or null
 */
export async function getDealById(id) {
  try {
    const result = await query(
      `SELECT * FROM deals WHERE id = $1`,
      [id]
    );
    return result.rows?.[0] || null;
  } catch (error) {
    console.error('Error fetching deal:', error);
    throw error;
  }
}

/**
 * Create new deal
 * @param {Object} data - Deal data
 * @param {string} userId - Creator user ID
 * @returns {Promise<Object>} Created deal
 */
export async function createDeal(data, userId) {
  try {
    const {
      title,
      description,
      value_estimate = 0,
      stage = 'Lead',
      probability = 50,
      assigned_to,
      expected_close_date,
      status = 'ACTIVE',
    } = data;

    const result = await query(
      `INSERT INTO deals (title, description, value_estimate, stage, probability, assigned_to, expected_close_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, description, value_estimate, stage, probability, assigned_to, expected_close_date, status, userId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating deal:', error);
    throw error;
  }
}

/**
 * Update deal
 * @param {string} id - Deal UUID
 * @param {Object} data - Updated deal data
 * @returns {Promise<Object>} Updated deal
 */
export async function updateDeal(id, data) {
  try {
    const { title, description, value_estimate, stage, probability, assigned_to, expected_close_date, status } = data;

    const result = await query(
      `UPDATE deals 
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           value_estimate = COALESCE($4, value_estimate),
           stage = COALESCE($5, stage),
           probability = COALESCE($6, probability),
           assigned_to = COALESCE($7, assigned_to),
           expected_close_date = COALESCE($8, expected_close_date),
           status = COALESCE($9, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, title, description, value_estimate, stage, probability, assigned_to, expected_close_date, status]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating deal:', error);
    throw error;
  }
}

/**
 * Update deal stage (for pipeline)
 * @param {string} id - Deal UUID
 * @param {string} newStage - New stage value
 * @returns {Promise<Object>} Updated deal
 */
export async function updateDealStage(id, newStage) {
  try {
    const result = await query(
      `UPDATE deals 
       SET stage = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, newStage]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating deal stage:', error);
    throw error;
  }
}

/**
 * Delete deal
 * @param {string} id - Deal UUID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteDeal(id) {
  try {
    const result = await query(
      `DELETE FROM deals WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting deal:', error);
    throw error;
  }
}

/**
 * Calculate total pipeline value (sum of all deal values)
 * @returns {Promise<number>} Total pipeline value
 */
export async function getTotalPipelineValue() {
  try {
    const result = await query(
      `SELECT COALESCE(SUM(value_estimate), 0) as total FROM deals WHERE status = 'ACTIVE'`
    );
    return Number(result.rows[0].total) || 0;
  } catch (error) {
    console.error('Error calculating pipeline value:', error);
    throw error;
  }
}

/**
 * Calculate weighted pipeline value (expected value based on probability)
 * Expected Value = value_estimate × (probability / 100)
 * @returns {Promise<number>} Weighted pipeline value
 */
export async function getWeightedPipelineValue() {
  try {
    const result = await query(
      `SELECT COALESCE(SUM(value_estimate * (probability / 100.0)), 0) as weighted_total 
       FROM deals WHERE status = 'ACTIVE'`
    );
    return Number(result.rows[0].weighted_total) || 0;
  } catch (error) {
    console.error('Error calculating weighted pipeline value:', error);
    throw error;
  }
}

/**
 * Get won deals total
 * @returns {Promise<number>} Sum of won deal values
 */
export async function getWonDealsTotal() {
  try {
    const result = await query(
      `SELECT COALESCE(SUM(value_estimate), 0) as total FROM deals WHERE stage = 'Won'`
    );
    return Number(result.rows[0].total) || 0;
  } catch (error) {
    console.error('Error calculating won deals total:', error);
    throw error;
  }
}

/**
 * Get lost deals total
 * @returns {Promise<number>} Sum of lost deal values
 */
export async function getLostDealsTotal() {
  try {
    const result = await query(
      `SELECT COALESCE(SUM(value_estimate), 0) as total FROM deals WHERE stage = 'Lost'`
    );
    return Number(result.rows[0].total) || 0;
  } catch (error) {
    console.error('Error calculating lost deals total:', error);
    throw error;
  }
}

/**
 * Get deal valuation summary
 * @returns {Promise<Object>} Valuation metrics
 */
export async function getDealValuationSummary() {
  try {
    const [total, weighted, won, lost] = await Promise.all([
      getTotalPipelineValue(),
      getWeightedPipelineValue(),
      getWonDealsTotal(),
      getLostDealsTotal(),
    ]);

    return {
      totalPipelineValue: total,
      weightedPipelineValue: weighted,
      wonDealsTotal: won,
      lostDealsTotal: lost,
    };
  } catch (error) {
    console.error('Error getting valuation summary:', error);
    throw error;
  }
}

/**
 * Get deal count by stage
 * @returns {Promise<Object>} Count of deals per stage
 */
export async function getDealCountByStage() {
  try {
    const result = await query(
      `SELECT stage, COUNT(*) as count FROM deals WHERE status = 'ACTIVE' GROUP BY stage`
    );

    const stages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
    const counts = {};

    stages.forEach(stage => {
      counts[stage] = 0;
    });

    result.rows.forEach(row => {
      counts[row.stage] = parseInt(row.count, 10);
    });

    return counts;
  } catch (error) {
    console.error('Error getting deal count by stage:', error);
    throw error;
  }
}

export default {
  getDeals,
  getDealsByStage,
  getDealById,
  createDeal,
  updateDeal,
  updateDealStage,
  deleteDeal,
  getTotalPipelineValue,
  getWeightedPipelineValue,
  getWonDealsTotal,
  getLostDealsTotal,
  getDealValuationSummary,
  getDealCountByStage,
};
