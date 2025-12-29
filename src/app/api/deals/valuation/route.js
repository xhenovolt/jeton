/**
 * Deal Valuation API Route
 * GET - Get deal valuation metrics
 * Returns: total pipeline value, weighted value, won/lost totals
 */

import { NextResponse } from 'next/server.js';
import { verifyToken } from '@/lib/jwt.js';
import { getDealValuationSummary } from '@/lib/deals.js';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
