/**
 * GET /api/equity/cap-table
 * Get current cap table (all shareholders with ownership %)
 */

import { getCapTable } from '@/lib/equity.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const holderType = searchParams.get('type');

    const capTable = await getCapTable({
      holder_type: holderType,
    });

    // Calculate totals
    const totalShares = capTable.reduce((sum, s) => sum + s.shares_owned, 0);
    const totalValue = capTable.reduce((sum, s) => sum + (s.investment_total || 0), 0);

    return Response.json({
      success: true,
      data: capTable,
      summary: {
        total_shareholders: capTable.length,
        total_shares_allocated: totalShares,
        total_investment: totalValue,
      },
    });
  } catch (error) {
    console.error('Cap table GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
