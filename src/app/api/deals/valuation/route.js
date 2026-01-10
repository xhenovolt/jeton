/**
 * Deal Valuation API Route
 * GET - Get deal valuation metrics
 * Returns: total pipeline value, weighted value, won/lost totals
 */

import { getDealValuationSummary } from '@/lib/deals.js';

export async function GET(request) {
  try {
    const valuation = await getDealValuationSummary();

    return Response.json({
      success: true,
      data: {
        totalPipelineValue: valuation.totalPipelineValue,
        weightedPipelineValue: valuation.weightedPipelineValue,
        wonDealsTotal: valuation.wonDealsTotal,
        lostDealsTotal: valuation.lostDealsTotal,
        currency: 'UGX',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/deals/valuation:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
