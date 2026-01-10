/**
 * GET/PUT /api/shares
 * Get or update company share configuration
 * 
 * CRITICAL: Valuation is synced from /api/valuations (Single Source of Truth)
 * 
 * New Model:
 * - authorized_shares: Maximum shares that can be issued (controls scarcity)
 * - company_valuation: Pulled from Dashboard valuation engine (NOT manual input)
 * - pricePerShare = strategic_company_value / authorized_shares (dynamic!)
 */

import { query } from '@/lib/db.js';
import { getValuationSummary } from '@/lib/valuations.js';

/**
 * Get strategic company value from database
 * This is the SINGLE SOURCE OF TRUTH for company valuation
 * OPTIMIZED: Selects only needed columns, uses 5-second cache
 */
const valuationCache = { value: null, timestamp: 0, ttl: 5000 };

async function getStrategicCompanyValue() {
  try {
    const now = Date.now();
    // Return cached value if still valid (5 seconds to avoid recalculation)
    if (valuationCache.value && (now - valuationCache.timestamp) < valuationCache.ttl) {
      return valuationCache.value;
    }

    // Get only needed columns for book value calculation
    const assetsResult = await query(`
      SELECT 
        acquisition_cost, 
        accumulated_depreciation
      FROM assets_accounting
      WHERE status != 'disposed'
    `);

    // Aggregate liabilities directly in SQL (faster)
    const liabilitiesResult = await query(`
      SELECT COALESCE(SUM(outstanding_amount), 0) as total
      FROM liabilities
      WHERE status IN ('ACTIVE', 'DEFERRED')
    `);

    // Get only needed columns for IP valuation
    const ipResult = await query(`
      SELECT valuation_estimate
      FROM intellectual_property
      WHERE status IN ('active', 'scaling', 'maintenance')
    `);

    // Get only needed columns for infrastructure
    const infraResult = await query(`
      SELECT replacement_cost
      FROM infrastructure
      WHERE status = 'active'
    `);

    // Calculate valuations using the shared library
    const valuation = getValuationSummary({
      assets: assetsResult.rows,
      liabilities: parseFloat(liabilitiesResult.rows[0]?.total || 0),
      ip: ipResult.rows,
      infrastructure: infraResult.rows,
    });

    const result = {
      accounting_net_worth: valuation.accountingNetWorth,
      strategic_company_value: valuation.strategicCompanyValue,
      total_ip_valuation: valuation.totalIPValuation,
      infrastructure_value: valuation.totalInfrastructureValue,
      total_liabilities: valuation.totalLiabilities,
      total_assets_book_value: valuation.totalAssetsBookValue,
      valuation_difference: valuation.valuationDifference,
    };
    
    // Cache for 5 seconds to avoid recalculation within same request/near-simultaneous calls
    valuationCache.value = result;
    valuationCache.timestamp = now;
    
    return result;
  } catch (error) {
    console.error('Error calculating strategic company value:', error);
    throw error;
  }
}

export async function GET(request) {
  const startTime = Date.now();
  try {
    console.log('[API] GET /api/shares - Starting request');
    const result = await query(`
      SELECT 
        id,
        authorized_shares,
        class_type,
        status,
        created_at,
        updated_at
      FROM shares
      LIMIT 1
    `);

    const shares = result.rows[0];

    if (!shares) {
      console.warn('[API] GET /api/shares - Share configuration not found');
      return Response.json(
        { success: false, error: 'Share configuration not found' },
        { status: 404 }
      );
    }

    // Get allocated shares count
    console.log('[API] GET /api/shares - Fetching allocated shares');
    const allocatedResult = await query(`
      SELECT COALESCE(SUM(shares_allocated), 0) as total_allocated
      FROM share_allocations
      WHERE status = 'active'
    `);

    // Get strategic company value from the dashboard's calculation engine
    console.log('[API] GET /api/shares - Calculating strategic company value');
    const valuationData = await getStrategicCompanyValue();
    console.log('[API] GET /api/shares - Valuation calculated:', valuationData.strategic_company_value);

    const totalAllocated = parseFloat(allocatedResult.rows[0]?.total_allocated || 0);
    const authorizedShares = parseInt(shares.authorized_shares);
    const strategicValue = parseFloat(valuationData.strategic_company_value || 0);
    const pricePerShare = authorizedShares > 0 ? strategicValue / authorizedShares : 0;

    return Response.json({
      success: true,
      data: {
        id: shares.id,
        authorized_shares: authorizedShares,
        class_type: shares.class_type,
        status: shares.status,
        created_at: shares.created_at,
        updated_at: shares.updated_at,
        // Synced from Dashboard valuation engine
        valuation: {
          accounting_net_worth: valuationData.accounting_net_worth,
          strategic_company_value: strategicValue,
          total_ip_valuation: valuationData.total_ip_valuation,
          infrastructure_value: valuationData.infrastructure_value,
          total_liabilities: valuationData.total_liabilities,
          total_assets_book_value: valuationData.total_assets_book_value,
          valuation_difference: valuationData.valuation_difference,
        },
        // Share metrics
        shares_allocated: parseInt(totalAllocated),
        shares_remaining: Math.max(0, authorizedShares - parseInt(totalAllocated)),
        price_per_share: parseFloat(pricePerShare.toFixed(2)),
        allocation_percentage: authorizedShares > 0 ? (totalAllocated / authorizedShares) * 100 : 0,
      },
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    console.error(`[API] GET /api/shares - ERROR after ${elapsed}ms:`, {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack?.split('\n')[0],
    });
    
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    console.log('[API] PUT /api/shares - Starting request');
    
    const body = await request.json();
    const { authorized_shares, class_type } = body;

    // NOTE: company_valuation is NOT editable - it comes from the Dashboard valuation engine
    if (body.company_valuation !== undefined) {
      return Response.json(
        { 
          success: false, 
          error: 'Company valuation cannot be manually set. It is synced from the Executive Valuation Dashboard.' 
        },
        { status: 400 }
      );
    }

    // Validate authorized_shares
    if (authorized_shares !== undefined && authorized_shares !== null) {
      if (authorized_shares <= 0) {
        return Response.json(
          { success: false, error: 'Authorized shares must be greater than 0' },
          { status: 400 }
        );
      }

      // Check if reducing authorized shares below allocated shares
      const allocatedResult = await query(`
        SELECT COALESCE(SUM(shares_allocated), 0) as total_allocated
        FROM share_allocations
        WHERE status = 'active'
      `);
      
      const totalAllocated = parseInt(allocatedResult.rows[0]?.total_allocated || 0);
      
      if (authorized_shares < totalAllocated) {
        return Response.json(
          { success: false, error: `Cannot reduce authorized shares below ${totalAllocated} already allocated shares` },
          { status: 400 }
        );
      }
    }

    // Build update query with only provided fields
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (authorized_shares !== undefined && authorized_shares !== null) {
      updates.push(`authorized_shares = $${paramCount}`);
      params.push(authorized_shares);
      paramCount++;
    }

    if (class_type) {
      updates.push(`class_type = $${paramCount}`);
      params.push(class_type);
      paramCount++;
    }

    if (updates.length === 0) {
      return Response.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `
      UPDATE shares 
      SET ${updates.join(', ')}
      WHERE id = (SELECT id FROM shares LIMIT 1)
      RETURNING *
      `,
      params
    );

    if (result.rowCount === 0) {
      // Create if doesn't exist
      const insertResult = await query(
        `
        INSERT INTO shares (authorized_shares, class_type)
        VALUES ($1, $2)
        RETURNING *
        `,
        [authorized_shares || 100, class_type || 'common']
      );

      return Response.json({
        success: true,
        data: insertResult.rows[0],
      });
    }

    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    // Handle auth errors from requireApiAuth
    if (error.status === 401) {
      console.warn('[API] PUT /api/shares - Unauthorized');
      return Response.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.error('[API] PUT /api/shares - ERROR:', {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack?.split('\n')[0],
    });
    
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
