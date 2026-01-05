/**
 * GET /api/valuations
 * Get complete valuation summary
 * 
 * Returns:
 * - Accounting net worth (tangible assets - liabilities)
 * - Strategic company value (includes IP and infrastructure)
 * - Detailed breakdown by domain
 */

import { query } from '@/lib/db.js';
import { getValuationSummary } from '@/lib/valuations.js';

export async function GET(request) {
  try {
    // Get only needed columns for book value calculation (faster)
    const assetsResult = await query(`
      SELECT 
        acquisition_cost, 
        accumulated_depreciation,
        asset_type,
        status
      FROM assets_accounting
      WHERE status != 'disposed'
    `);

    // Get all liabilities
    const liabilitiesResult = await query(`
      SELECT COALESCE(SUM(outstanding_amount), 0) as total
      FROM liabilities
      WHERE status IN ('ACTIVE', 'DEFERRED')
    `);

    // Get only needed columns for IP valuation (faster)
    const ipResult = await query(`
      SELECT 
        valuation_estimate,
        ip_type,
        status
      FROM intellectual_property
      WHERE status IN ('active', 'scaling', 'maintenance')
    `);

    // Get only needed columns for infrastructure (faster)
    const infraResult = await query(`
      SELECT 
        replacement_cost,
        risk_level,
        status
      FROM infrastructure
      WHERE status = 'active'
    `);

    // Get asset breakdown by type
    const assetsByType = await query(`
      SELECT 
        asset_type,
        COUNT(*) as count,
        SUM(acquisition_cost) as total_cost,
        SUM(accumulated_depreciation) as total_depreciation,
        SUM(current_book_value) as total_book_value
      FROM assets_accounting
      WHERE status != 'disposed'
      GROUP BY asset_type
      ORDER BY total_book_value DESC
    `);

    // Get IP breakdown by type
    const ipByType = await query(`
      SELECT 
        ip_type,
        COUNT(*) as count,
        SUM(development_cost) as total_cost,
        SUM(valuation_estimate) as total_valuation,
        SUM(revenue_generated_lifetime) as total_revenue
      FROM intellectual_property
      WHERE status IN ('active', 'scaling', 'maintenance')
      GROUP BY ip_type
      ORDER BY total_valuation DESC
    `);

    // Get infrastructure by risk level
    const infraByRisk = await query(`
      SELECT 
        risk_level,
        COUNT(*) as count,
        SUM(replacement_cost) as total_replacement_cost
      FROM infrastructure
      WHERE status = 'active'
      GROUP BY risk_level
      ORDER BY 
        CASE risk_level 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    // Calculate valuations
    const valuation = getValuationSummary({
      assets: assetsResult.rows,
      liabilities: parseFloat(liabilitiesResult.rows[0]?.total || 0),
      ip: ipResult.rows,
      infrastructure: infraResult.rows,
    });

    // Convert assetsByType array to object keyed by type
    const assetsByTypeObj = {};
    assetsByType.rows.forEach(row => {
      assetsByTypeObj[row.asset_type] = {
        count: row.count,
        total: parseFloat(row.total_book_value || 0),
      };
    });

    // Convert ipByType array to object keyed by type
    const ipByTypeObj = {};
    ipByType.rows.forEach(row => {
      ipByTypeObj[row.ip_type] = {
        count: row.count,
        total: parseFloat(row.total_valuation || 0),
      };
    });

    // Convert infraByRisk array to object keyed by risk level
    const infraByRiskObj = {};
    infraByRisk.rows.forEach(row => {
      infraByRiskObj[row.risk_level] = {
        risk_level: row.risk_level,
        count: row.count,
        total_replacement_cost: parseFloat(row.total_replacement_cost || 0),
      };
    });

    return Response.json({
      success: true,
      data: {
        summary: {
          accounting_net_worth: valuation.accountingNetWorth,
          strategic_company_value: valuation.strategicCompanyValue,
          total_assets_book_value: valuation.totalAssetsBookValue,
          total_liabilities: valuation.totalLiabilities,
          total_ip_valuation: valuation.totalIPValuation,
          infrastructure_risk_coverage: valuation.totalInfrastructureValue,
        },
        assetsByType: assetsByTypeObj,
        ipByType: ipByTypeObj,
        infrastructureByRisk: infraByRiskObj,
        counts: {
          accounting_assets: assetsResult.rowCount,
          intellectual_property: ipResult.rowCount,
          infrastructure: infraResult.rowCount,
          liabilities: liabilitiesResult.rowCount,
        },
      },
    });
  } catch (error) {
    console.error('Valuation GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
