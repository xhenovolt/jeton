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
 * Create new deal with structural enforcement
 * RULES (Founder-First):
 * - system_id is REQUIRED (must select which system this deal is for)
 * - prospect_id OR client_id is REQUIRED (deal must be linked to a person)
 * - No anonymous deals allowed
 * 
 * @param {Object} data - Deal data
 * @param {string} userId - Creator user ID
 * @returns {Promise<Object>} Created deal or throws structural error
 */
export async function createDeal(data, userId) {
  try {
    const {
      title,
      description,
      value_estimate = 0,
      stage = 'Lead',
      probability = 50,
      system_id,
      prospect_id,
      client_id,
      assigned_to,
      expected_close_date,
      status = 'ACTIVE',
    } = data;

    // ========== STRUCTURAL ENFORCEMENT ==========
    // Rule 1: Deal MUST link to a system
    if (!system_id) {
      throw new Error(
        'STRUCTURAL ERROR: Deal creation requires system_id. ' +
        'Select which system this deal is selling, then create the deal.'
      );
    }

    // Rule 2: Deal MUST link to prospect OR client (not both optional)
    if (!prospect_id && !client_id) {
      throw new Error(
        'STRUCTURAL ERROR: Deal must link to a prospect OR client. ' +
        'No anonymous deals allowed. Identify the decision-maker first.'
      );
    }

    // Rule 3: Validate system_id exists
    const systemCheck = await query(
      'SELECT id FROM intellectual_property WHERE id = $1',
      [system_id]
    );
    if (systemCheck.rowCount === 0) {
      throw new Error(`System with ID ${system_id} does not exist. Select a valid system.`);
    }

    // Rule 4: If prospect_id provided, validate it exists
    if (prospect_id) {
      const prospectCheck = await query(
        'SELECT id FROM prospect_contacts WHERE id = $1',
        [prospect_id]
      );
      if (prospectCheck.rowCount === 0) {
        throw new Error(`Prospect with ID ${prospect_id} does not exist.`);
      }
    }

    // Rule 5: If client_id provided, validate it exists
    if (client_id) {
      const clientCheck = await query(
        'SELECT id FROM clients WHERE id = $1',
        [client_id]
      );
      if (clientCheck.rowCount === 0) {
        throw new Error(`Client with ID ${client_id} does not exist.`);
      }
    }

    // ========== CREATE DEAL WITH ENFORCED RELATIONSHIPS ==========
    const result = await query(
      `INSERT INTO deals (
        title, 
        description, 
        value_estimate, 
        stage, 
        probability, 
        system_id,
        prospect_id,
        client_id,
        assigned_to, 
        expected_close_date, 
        status, 
        created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        title,
        description,
        value_estimate,
        stage,
        probability,
        system_id,
        prospect_id,
        client_id,
        assigned_to,
        expected_close_date,
        status,
        userId,
      ]
    );

    const deal = result.rows[0];
    
    // Log deal creation with system link
    console.log(`✓ Deal created: "${title}" for system ${system_id}, linked to ${prospect_id ? 'prospect' : 'client'}`);

    return deal;
  } catch (error) {
    console.error('Error creating deal:', error);
    throw error;
  }
}

/**
 * Update deal with structural enforcement
 * Validates that deal maintains required relationships
 * 
 * @param {string} id - Deal UUID
 * @param {Object} data - Updated deal data
 * @returns {Promise<Object>} Updated deal or throws structural error
 */
export async function updateDeal(id, data) {
  try {
    // Get current deal to validate relationships
    const currentDeal = await getDealById(id);
    if (!currentDeal) {
      throw new Error(`Deal ${id} not found`);
    }

    const {
      title,
      description,
      value_estimate,
      stage,
      probability,
      system_id = currentDeal.system_id,
      prospect_id = currentDeal.prospect_id,
      client_id = currentDeal.client_id,
      assigned_to,
      expected_close_date,
      status,
    } = data;

    // ========== STRUCTURAL ENFORCEMENT ==========
    // Rule: If changing system_id, validate it exists
    if (system_id && system_id !== currentDeal.system_id) {
      const systemCheck = await query(
        'SELECT id FROM intellectual_property WHERE id = $1',
        [system_id]
      );
      if (systemCheck.rowCount === 0) {
        throw new Error(`System with ID ${system_id} does not exist.`);
      }
    }

    // Rule: Ensure deal still has prospect_id OR client_id
    if (!prospect_id && !client_id) {
      throw new Error(
        'STRUCTURAL ERROR: Deal must maintain link to prospect OR client. ' +
        'Cannot remove all contact links.'
      );
    }

    // Rule: If prospect_id provided, validate it exists
    if (prospect_id && prospect_id !== currentDeal.prospect_id) {
      const prospectCheck = await query(
        'SELECT id FROM prospect_contacts WHERE id = $1',
        [prospect_id]
      );
      if (prospectCheck.rowCount === 0) {
        throw new Error(`Prospect with ID ${prospect_id} does not exist.`);
      }
    }

    // Rule: If client_id provided, validate it exists
    if (client_id && client_id !== currentDeal.client_id) {
      const clientCheck = await query(
        'SELECT id FROM clients WHERE id = $1',
        [client_id]
      );
      if (clientCheck.rowCount === 0) {
        throw new Error(`Client with ID ${client_id} does not exist.`);
      }
    }

    // ========== UPDATE DEAL ==========
    const result = await query(
      `UPDATE deals 
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           value_estimate = COALESCE($4, value_estimate),
           stage = COALESCE($5, stage),
           probability = COALESCE($6, probability),
           system_id = COALESCE($7, system_id),
           prospect_id = COALESCE($8, prospect_id),
           client_id = COALESCE($9, client_id),
           assigned_to = COALESCE($10, assigned_to),
           expected_close_date = COALESCE($11, expected_close_date),
           status = COALESCE($12, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        title,
        description,
        value_estimate,
        stage,
        probability,
        system_id,
        prospect_id,
        client_id,
        assigned_to,
        expected_close_date,
        status,
      ]
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
