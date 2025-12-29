/**
 * Financial Management Library
 * Handles assets, liabilities, and net worth calculations
 */

import { query } from './db.js';

/**
 * Get all assets
 * @returns {Promise<Array>} Array of assets
 */
export async function getAssets() {
  try {
    const result = await query(`
      SELECT * FROM assets 
      ORDER BY created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching assets:', error.message);
    return [];
  }
}

/**
 * Get asset by ID
 * @param {string} assetId - Asset UUID
 * @returns {Promise<Object|null>} Asset object or null
 */
export async function getAssetById(assetId) {
  try {
    const result = await query(
      'SELECT * FROM assets WHERE id = $1',
      [assetId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching asset:', error.message);
    return null;
  }
}

/**
 * Create a new asset
 * @param {Object} data - Asset data
 * @param {string} userId - User ID who created the asset
 * @returns {Promise<Object|null>} Created asset or null on error
 */
export async function createAsset(data, userId) {
  try {
    const {
      name,
      category,
      acquisition_source,
      acquisition_date,
      acquisition_cost,
      current_value,
      depreciation_rate = 0,
      notes,
    } = data;

    const result = await query(
      `INSERT INTO assets (
        name, category, acquisition_source, acquisition_date,
        acquisition_cost, current_value, depreciation_rate, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        name,
        category,
        acquisition_source || null,
        acquisition_date || null,
        acquisition_cost || null,
        current_value,
        depreciation_rate,
        notes || null,
        userId,
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating asset:', error.message);
    return null;
  }
}

/**
 * Update an asset
 * @param {string} assetId - Asset UUID
 * @param {Object} data - Asset data to update
 * @returns {Promise<Object|null>} Updated asset or null on error
 */
export async function updateAsset(assetId, data) {
  try {
    const {
      name,
      category,
      acquisition_source,
      acquisition_date,
      acquisition_cost,
      current_value,
      depreciation_rate,
      notes,
    } = data;

    const result = await query(
      `UPDATE assets SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        acquisition_source = COALESCE($3, acquisition_source),
        acquisition_date = COALESCE($4, acquisition_date),
        acquisition_cost = COALESCE($5, acquisition_cost),
        current_value = COALESCE($6, current_value),
        depreciation_rate = COALESCE($7, depreciation_rate),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *`,
      [
        name,
        category,
        acquisition_source,
        acquisition_date,
        acquisition_cost,
        current_value,
        depreciation_rate,
        notes,
        assetId,
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating asset:', error.message);
    return null;
  }
}

/**
 * Delete an asset
 * @param {string} assetId - Asset UUID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
export async function deleteAsset(assetId) {
  try {
    const result = await query(
      'DELETE FROM assets WHERE id = $1 RETURNING id',
      [assetId]
    );
    return !!result.rows[0];
  } catch (error) {
    console.error('Error deleting asset:', error.message);
    return false;
  }
}

/**
 * Get all liabilities
 * @returns {Promise<Array>} Array of liabilities
 */
export async function getLiabilities() {
  try {
    const result = await query(`
      SELECT * FROM liabilities 
      ORDER BY created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching liabilities:', error.message);
    return [];
  }
}

/**
 * Get liability by ID
 * @param {string} liabilityId - Liability UUID
 * @returns {Promise<Object|null>} Liability object or null
 */
export async function getLiabilityById(liabilityId) {
  try {
    const result = await query(
      'SELECT * FROM liabilities WHERE id = $1',
      [liabilityId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching liability:', error.message);
    return null;
  }
}

/**
 * Create a new liability
 * @param {Object} data - Liability data
 * @param {string} userId - User ID who created the liability
 * @returns {Promise<Object|null>} Created liability or null on error
 */
export async function createLiability(data, userId) {
  try {
    const {
      name,
      category,
      creditor,
      principal_amount,
      outstanding_amount,
      interest_rate = 0,
      due_date,
      status = 'ACTIVE',
      notes,
    } = data;

    const result = await query(
      `INSERT INTO liabilities (
        name, category, creditor, principal_amount, outstanding_amount,
        interest_rate, due_date, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        name,
        category,
        creditor || null,
        principal_amount,
        outstanding_amount,
        interest_rate,
        due_date || null,
        status,
        notes || null,
        userId,
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating liability:', error.message);
    return null;
  }
}

/**
 * Update a liability
 * @param {string} liabilityId - Liability UUID
 * @param {Object} data - Liability data to update
 * @returns {Promise<Object|null>} Updated liability or null on error
 */
export async function updateLiability(liabilityId, data) {
  try {
    const {
      name,
      category,
      creditor,
      principal_amount,
      outstanding_amount,
      interest_rate,
      due_date,
      status,
      notes,
    } = data;

    const result = await query(
      `UPDATE liabilities SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        creditor = COALESCE($3, creditor),
        principal_amount = COALESCE($4, principal_amount),
        outstanding_amount = COALESCE($5, outstanding_amount),
        interest_rate = COALESCE($6, interest_rate),
        due_date = COALESCE($7, due_date),
        status = COALESCE($8, status),
        notes = COALESCE($9, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
      [
        name,
        category,
        creditor,
        principal_amount,
        outstanding_amount,
        interest_rate,
        due_date,
        status,
        notes,
        liabilityId,
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating liability:', error.message);
    return null;
  }
}

/**
 * Delete a liability
 * @param {string} liabilityId - Liability UUID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
export async function deleteLiability(liabilityId) {
  try {
    const result = await query(
      'DELETE FROM liabilities WHERE id = $1 RETURNING id',
      [liabilityId]
    );
    return !!result.rows[0];
  } catch (error) {
    console.error('Error deleting liability:', error.message);
    return false;
  }
}

/**
 * Get total assets value
 * @returns {Promise<number>} Total assets value
 */
export async function getTotalAssets() {
  try {
    const result = await query(
      'SELECT COALESCE(SUM(current_value), 0) as total FROM assets'
    );
    return parseFloat(result.rows[0]?.total || 0);
  } catch (error) {
    console.error('Error calculating total assets:', error.message);
    return 0;
  }
}

/**
 * Get total liabilities value
 * @returns {Promise<number>} Total liabilities value
 */
export async function getTotalLiabilities() {
  try {
    const result = await query(
      'SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM liabilities WHERE status != \'CLEARED\''
    );
    return parseFloat(result.rows[0]?.total || 0);
  } catch (error) {
    console.error('Error calculating total liabilities:', error.message);
    return 0;
  }
}

/**
 * Get net worth (assets - liabilities)
 * @returns {Promise<number>} Net worth value
 */
export async function getNetWorth() {
  try {
    const totalAssets = await getTotalAssets();
    const totalLiabilities = await getTotalLiabilities();
    return totalAssets - totalLiabilities;
  } catch (error) {
    console.error('Error calculating net worth:', error.message);
    return 0;
  }
}

export default {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getLiabilities,
  getLiabilityById,
  createLiability,
  updateLiability,
  deleteLiability,
  getTotalAssets,
  getTotalLiabilities,
  getNetWorth,
};
