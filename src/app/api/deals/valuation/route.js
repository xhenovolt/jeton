/**
 * Deal Valuation API Route
 * GET - Get deal valuation metrics
 * Returns: total pipeline value, weighted value, won/lost totals
 */

import { NextResponse } from 'next/server.js';
import { requireApiAuth } from '@/lib/api-auth.js';
import { getDealValuationSummary } from '@/lib/deals.js';

export async function GET(request) {
  try {
    const user = await requireApiAuth();

    const valuation = await getDealValuationSummary();

    return NextResponse.json({
      totalPipelineValue: valuation.totalPipelineValue,
      weightedPipelineValue: valuation.weightedPipelineValue,
      wonDealsTotal: valuation.wonDealsTotal,
      lostDealsTotal: valuation.lostDealsTotal,
      currency: 'UGX',
    });
  } catch (error) {
    console.error('Error in GET /api/deals/valuation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
