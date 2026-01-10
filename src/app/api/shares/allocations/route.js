/**
 * GET/POST /api/shares/allocations
 * Manage share allocations to owners
 * 
 * CRITICAL: All valuations synced from Dashboard engine
 * 
 * Share Value Formula:
 * value = shares_allocated * (strategic_company_value / authorized_shares)
 * 
 * Ownership %:
 * ownership = (shares_allocated / authorized_shares) * 100
 */

import { query } from '@/lib/db.js';
import { getValuationSummary } from '@/lib/valuations.js';
import { requireApiAuth } from '@/lib/api-auth.js';

/**
 * Get strategic company value (SINGLE SOURCE OF TRUTH)
 * OPTIMIZED: Uses 5-second cache to avoid redundant calculation
 */
const valuationCache = { value: null, timestamp: 0, ttl: 5000 };

async function getStrategicCompanyValue() {
  try {
    const now = Date.now();
    // Return cached value if still valid (5 seconds)
    if (valuationCache.value !== null && (now - valuationCache.timestamp) < valuationCache.ttl) {
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

    // Aggregate liabilities directly in SQL
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

    const result = parseFloat(valuation.strategicCompanyValue || 0);
    
    // Cache for 5 seconds
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
    // Authenticate user
    const user = await requireApiAuth();
    
    console.log('[API] GET /api/shares/allocations - Starting request for user:', user.userId);
    
    // Get shares config first
    const sharesResult = await query('SELECT authorized_shares FROM shares LIMIT 1');
    const authorizedShares = sharesResult.rows[0]?.authorized_shares || 0;
    
    // Get all active allocations
    const result = await query(`
      SELECT 
        sa.id,
        sa.owner_id,
        sa.owner_name,
        sa.owner_email,
        sa.shares_allocated,
        sa.allocation_date,
        sa.vesting_start_date,
        sa.vesting_end_date,
        sa.vesting_percentage,
        sa.notes,
        sa.status,
        sa.created_at,
        sa.updated_at
      FROM share_allocations sa
      WHERE sa.status = 'active'
      ORDER BY sa.allocation_date DESC
    `);

    // Get strategic company value from Dashboard engine
    console.log('[API] GET /api/shares/allocations - Getting strategic value');
    const strategicValue = await getStrategicCompanyValue();
    console.log('[API] GET /api/shares/allocations - Found', result.rows.length, 'allocations');

    const allocations = result.rows.map(row => {
      const sharesAllocated = parseInt(row.shares_allocated);
      const pricePerShare = authorizedShares > 0 ? strategicValue / authorizedShares : 0;
      const allocatedValue = sharesAllocated * pricePerShare;

      return {
        id: row.id,
        owner_id: row.owner_id,
        owner_name: row.owner_name,
        owner_email: row.owner_email,
        shares_allocated: sharesAllocated,
        allocation_date: row.allocation_date,
        vesting_start_date: row.vesting_start_date,
        vesting_end_date: row.vesting_end_date,
        vesting_percentage: row.vesting_percentage,
        notes: row.notes,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        // Synced from Dashboard valuation engine
        authorized_shares: authorizedShares,
        strategic_company_value: strategicValue,
        price_per_share: parseFloat(pricePerShare.toFixed(2)),
        ownership_percentage: authorizedShares > 0 ? parseFloat(((sharesAllocated / authorizedShares) * 100).toFixed(2)) : 0,
        share_value: parseFloat(allocatedValue.toFixed(2)),
      };
    });

    return Response.json({
      success: true,
      data: allocations,
      count: result.rowCount,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    // Handle auth errors
    if (error.status === 401) {
      console.warn(`[API] GET /api/shares/allocations - Unauthorized after ${elapsed}ms`);
      return Response.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.error(`[API] GET /api/shares/allocations - ERROR after ${elapsed}ms:`, {
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

export async function POST(request) {
  try {
    // Authenticate user
    const user = await requireApiAuth();
    
    console.log('[API] POST /api/shares/allocations - Starting request for user:', user.userId);
    
    const body = await request.json();
    const {
      owner_id,
      owner_name,
      owner_email,
      shares_allocated,
      allocation_date,
      vesting_start_date,
      vesting_end_date,
      vesting_percentage,
      notes,
    } = body;

    // Validation
    if (!owner_name || !shares_allocated || shares_allocated <= 0) {
      return Response.json(
        { success: false, error: 'Owner name and positive shares required' },
        { status: 400 }
      );
    }

    // Check allocation doesn't exceed authorized shares
    const sharesCheck = await query(`
      SELECT s.authorized_shares, COALESCE(SUM(sa.shares_allocated), 0) as allocated
      FROM shares s
      LEFT JOIN share_allocations sa ON sa.status = 'active'
      GROUP BY s.authorized_shares
      LIMIT 1
    `);

    const authorizedShares = parseInt(sharesCheck.rows[0]?.authorized_shares || 100);
    const currentAllocated = parseInt(sharesCheck.rows[0]?.allocated || 0);

    if (currentAllocated + shares_allocated > authorizedShares) {
      return Response.json(
        {
          success: false,
          error: `Cannot allocate ${shares_allocated} shares. Only ${authorizedShares - currentAllocated} shares available (${authorizedShares} authorized, ${currentAllocated} allocated).`,
        },
        { status: 400 }
      );
    }

    const result = await query(
      `
      INSERT INTO share_allocations (
        owner_id, owner_name, owner_email, shares_allocated, 
        allocation_date, vesting_start_date, vesting_end_date, 
        vesting_percentage, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        owner_id || null,
        owner_name,
        owner_email || null,
        shares_allocated,
        allocation_date || new Date().toISOString().split('T')[0],
        vesting_start_date || null,
        vesting_end_date || null,
        vesting_percentage || 100,
        notes || null,
        'active',
      ]
    );

    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    // Handle auth errors
    if (error.status === 401) {
      console.warn('[API] POST /api/shares/allocations - Unauthorized');
      return Response.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.error('[API] POST /api/shares/allocations - ERROR:', {
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
