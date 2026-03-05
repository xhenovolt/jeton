/**
 * Deal Valuation API Route
 * GET - Get deal valuation metrics
 * Returns: total pipeline value, weighted value, won/lost totals
 */

import { getDealValuationSummary } from '@/lib/deals.js';

export async function GET(request) {
  try {
    const valuation = await getDealValuationSummary();

    // Defensive: ensure all expected fields exist with fallback values
    return Response.json({
      success: true,
      totalPipelineValue: valuation?.totalPipelineValue || 0,
      weightedPipelineValue: valuation?.weightedPipelineValue || 0,
      wonDealsTotal: valuation?.wonDealsTotal || 0,
      lostDealsTotal: valuation?.lostDealsTotal || 0,
      currency: 'UGX',
    });
  } catch (error) {
    console.error('Error in GET /api/deals/valuation:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
