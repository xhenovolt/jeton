/**
 * GET /api/net-worth
 * Get financial overview: total assets, total liabilities, and net worth
 */

import { getTotalAssets, getTotalLiabilities, getNetWorth } from '@/lib/financial.js';

export async function GET(request) {
  try {
    // Calculate financial metrics
    const totalAssets = await getTotalAssets();
    const totalLiabilities = await getTotalLiabilities();
    const netWorth = await getNetWorth();

    return Response.json({
      success: true,
      data: {
        totalAssets: parseFloat(totalAssets.toFixed(2)),
        totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
        netWorth: parseFloat(netWorth.toFixed(2)),
        currency: 'UGX',
      },
    });
  } catch (error) {
    console.error('Get net worth error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
