/**
 * Financial Reports & Intelligence
 * Server-side aggregations for executive dashboard
 */

import { query } from './db.js';

/**
 * Get executive summary dashboard data
 * @returns {Object} Dashboard metrics
 */
export async function getExecutiveSummary() {
  try {
    // Get net worth components
    const netWorthResult = await query(`
      SELECT 
        COALESCE(SUM(current_value), 0) as total_assets,
        (SELECT COALESCE(SUM(outstanding_amount), 0) FROM liabilities) as total_liabilities
      FROM assets
    `);

    const totalAssets = parseFloat(netWorthResult.rows[0]?.total_assets || 0);
    const totalLiabilities = parseFloat(netWorthResult.rows[0]?.total_liabilities || 0);
    const netWorth = totalAssets - totalLiabilities;

    // Get pipeline metrics
    const pipelineResult = await query(`
      SELECT 
        COALESCE(SUM(value_estimate), 0) as total_pipeline,
        COALESCE(SUM(value_estimate * (probability::numeric / 100)), 0) as weighted_revenue,
        COALESCE(SUM(CASE WHEN stage = 'Won' THEN value_estimate ELSE 0 END), 0) as won_deals,
        COALESCE(SUM(CASE WHEN stage = 'Lost' THEN value_estimate ELSE 0 END), 0) as lost_deals,
        COUNT(*) as total_deals
      FROM deals
      WHERE status = 'ACTIVE'
    `);

    const pipelineData = pipelineResult.rows[0];
    const totalPipeline = parseFloat(pipelineData?.total_pipeline || 0);
    const weightedRevenue = parseFloat(pipelineData?.weighted_revenue || 0);
    const wonDeals = parseFloat(pipelineData?.won_deals || 0);
    const lostDeals = parseFloat(pipelineData?.lost_deals || 0);

    // Calculate metrics
    const conversionRate = pipelineData?.total_deals > 0 
      ? ((parseFloat(pipelineData.won_deals || 0) / pipelineData.total_deals) * 100).toFixed(1)
      : 0;

    return {
      netWorth: Math.round(netWorth),
      totalAssets: Math.round(totalAssets),
      totalLiabilities: Math.round(totalLiabilities),
      totalPipeline: Math.round(totalPipeline),
      weightedRevenue: Math.round(weightedRevenue),
      wonDeals: Math.round(wonDeals),
      lostDeals: Math.round(lostDeals),
      conversionRate: parseFloat(conversionRate),
      currency: 'UGX'
    };
  } catch (error) {
    console.error('Error fetching executive summary:', error);
    throw error;
  }
}

/**
 * Get top assets by value
 * @param {number} limit - Number of assets to return
 * @returns {Array} Top assets
 */
export async function getTopAssets(limit = 5) {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        category,
        current_value,
        depreciation_rate,
        created_at
      FROM assets
      ORDER BY current_value DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      value: Math.round(parseFloat(row.current_value)),
      depreciation: parseFloat(row.depreciation_rate)
    }));
  } catch (error) {
    console.error('Error fetching top assets:', error);
    throw error;
  }
}

/**
 * Get top liabilities by outstanding amount
 * @param {number} limit - Number of liabilities to return
 * @returns {Array} Top liabilities
 */
export async function getTopLiabilities(limit = 5) {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        category,
        outstanding_amount,
        interest_rate,
        due_date,
        status,
        created_at
      FROM liabilities
      ORDER BY outstanding_amount DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      outstanding: Math.round(parseFloat(row.outstanding_amount)),
      interestRate: parseFloat(row.interest_rate),
      dueDate: row.due_date,
      status: row.status,
      riskScore: calculateLiabilityRisk(
        parseFloat(row.outstanding_amount),
        parseFloat(row.interest_rate),
        row.status
      )
    }));
  } catch (error) {
    console.error('Error fetching top liabilities:', error);
    throw error;
  }
}

/**
 * Get financial data over time (monthly grouping)
 * @returns {Array} Monthly financial data
 */
export async function getFinancialTrendData() {
  try {
    const result = await query(`
      SELECT 
        DATE_TRUNC('month', created_at)::date as month,
        SUM(current_value) as assets_total,
        (SELECT COALESCE(SUM(outstanding_amount), 0) 
         FROM liabilities 
         WHERE created_at <= DATE_TRUNC('month', assets.created_at) + INTERVAL '1 month') as liabilities_total
      FROM assets
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 12
    `);

    return result.rows.reverse().map(row => ({
      month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      assets: Math.round(parseFloat(row.assets_total || 0)),
      liabilities: Math.round(parseFloat(row.liabilities_total || 0)),
      netWorth: Math.round(parseFloat(row.assets_total || 0) - parseFloat(row.liabilities_total || 0))
    }));
  } catch (error) {
    console.error('Error fetching financial trend data:', error);
    throw error;
  }
}

/**
 * Get pipeline funnel data
 * @returns {Array} Pipeline stage data
 */
export async function getPipelineFunnelData() {
  try {
    const stages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
    
    const result = await query(`
      SELECT 
        stage,
        COUNT(*) as count,
        COALESCE(SUM(value_estimate), 0) as total_value,
        COALESCE(ROUND(AVG(probability::numeric), 1), 0) as avg_probability
      FROM deals
      WHERE status = 'ACTIVE'
      GROUP BY stage
    `);

    const stageMap = new Map(result.rows.map(row => [row.stage, row]));

    return stages.map(stage => {
      const data = stageMap.get(stage);
      return {
        stage,
        count: data?.count || 0,
        value: Math.round(parseFloat(data?.total_value || 0)),
        probability: parseFloat(data?.avg_probability || 0)
      };
    });
  } catch (error) {
    console.error('Error fetching pipeline funnel data:', error);
    throw error;
  }
}

/**
 * Get deal win/loss ratio data
 * @returns {Object} Win/loss metrics
 */
export async function getDealWinLossData() {
  try {
    const result = await query(`
      SELECT 
        stage,
        COUNT(*) as count,
        COALESCE(SUM(value_estimate), 0) as total_value
      FROM deals
      WHERE stage IN ('Won', 'Lost')
      GROUP BY stage
    `);

    const rows = result.rows;
    const wonRow = rows.find(r => r.stage === 'Won') || { count: 0, total_value: 0 };
    const lostRow = rows.find(r => r.stage === 'Lost') || { count: 0, total_value: 0 };

    return [
      {
        name: 'Won',
        deals: parseInt(wonRow.count),
        value: Math.round(parseFloat(wonRow.total_value))
      },
      {
        name: 'Lost',
        deals: parseInt(lostRow.count),
        value: Math.round(parseFloat(lostRow.total_value))
      }
    ];
  } catch (error) {
    console.error('Error fetching deal win/loss data:', error);
    throw error;
  }
}

/**
 * Get net worth trend over time
 * @returns {Array} Historical net worth data
 */
export async function getNetWorthTrendData() {
  try {
    const result = await query(`
      WITH monthly_data AS (
        SELECT 
          DATE_TRUNC('month', created_at)::date as month,
          SUM(current_value) as assets_total
        FROM assets
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      monthly_liabilities AS (
        SELECT 
          DATE_TRUNC('month', created_at)::date as month,
          SUM(outstanding_amount) as liabilities_total
        FROM liabilities
        GROUP BY DATE_TRUNC('month', created_at)
      )
      SELECT 
        COALESCE(md.month, ml.month) as month,
        COALESCE(md.assets_total, 0) as assets,
        COALESCE(ml.liabilities_total, 0) as liabilities
      FROM monthly_data md
      FULL OUTER JOIN monthly_liabilities ml ON md.month = ml.month
      ORDER BY month DESC
      LIMIT 12
    `);

    return result.rows.reverse().map(row => ({
      month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      assets: Math.round(parseFloat(row.assets || 0)),
      liabilities: Math.round(parseFloat(row.liabilities || 0)),
      netWorth: Math.round(parseFloat(row.assets || 0) - parseFloat(row.liabilities || 0))
    }));
  } catch (error) {
    console.error('Error fetching net worth trend data:', error);
    throw error;
  }
}

/**
 * Calculate liability risk score (0-100)
 * @private
 */
function calculateLiabilityRisk(outstanding, interestRate, status) {
  let riskScore = 0;

  // Interest rate factor (0-40 points)
  riskScore += Math.min(interestRate * 2, 40);

  // Status factor (0-30 points)
  const statusRisk = {
    'ACTIVE': 0,
    'DEFERRED': 20,
    'DEFAULTED': 30,
    'CLEARED': 0
  };
  riskScore += statusRisk[status] || 0;

  // Amount factor (0-30 points)
  if (outstanding > 10000000) riskScore += 30;
  else if (outstanding > 5000000) riskScore += 20;
  else if (outstanding > 1000000) riskScore += 10;

  return Math.min(Math.round(riskScore), 100);
}

/**
 * Create a snapshot of current financial state
 * @param {string} type - Snapshot type
 * @param {string} userId - User ID
 * @returns {Object} Created snapshot
 */
export async function createSnapshot(type, userId) {
  try {
    const data = await getExecutiveSummary();
    
    const result = await query(`
      INSERT INTO snapshots (type, data, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, type, data, created_at
    `, [type, JSON.stringify(data), userId]);

    return {
      id: result.rows[0].id,
      type: result.rows[0].type,
      data: result.rows[0].data,
      createdAt: result.rows[0].created_at
    };
  } catch (error) {
    console.error('Error creating snapshot:', error);
    throw error;
  }
}

/**
 * Get all snapshots
 * @param {string} type - Filter by snapshot type (optional)
 * @returns {Array} Snapshots
 */
export async function getSnapshots(type = null) {
  try {
    let sql = `
      SELECT id, type, name, data, created_by, created_at
      FROM snapshots
    `;
    
    const params = [];
    if (type) {
      sql += ` WHERE type = $1`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await query(sql, params);

    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      name: row.name || `${row.type} - ${new Date(row.created_at).toLocaleDateString()}`,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      createdAt: row.created_at,
      createdBy: row.created_by
    }));
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    throw error;
  }
}

/**
 * Get snapshot by ID
 * @param {string} id - Snapshot ID
 * @returns {Object} Snapshot data
 */
export async function getSnapshot(id) {
  try {
    const result = await query(`
      SELECT id, type, name, data, created_by, created_at
      FROM snapshots
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    throw error;
  }
}
