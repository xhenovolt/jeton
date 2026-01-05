/**
 * GET /api/net-worth
 * Get financial overview: total assets, total liabilities, and net worth
 */

import { NextResponse } from 'next/server.js';
import { requireApiAuth } from '@/lib/api-auth.js';
import { getTotalAssets, getTotalLiabilities, getNetWorth } from '@/lib/financial.js';

export async function GET(request) {
  try {
    const user = await requireApiAuth();

    // Calculate financial metrics
    const totalAssets = await getTotalAssets();
    const totalLiabilities = await getTotalLiabilities();
    const netWorth = await getNetWorth();

    return NextResponse.json({
      totalAssets: parseFloat(totalAssets.toFixed(2)),
      totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
      netWorth: parseFloat(netWorth.toFixed(2)),
      currency: 'UGX',
    });
  } catch (error) {
    console.error('Get net worth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
