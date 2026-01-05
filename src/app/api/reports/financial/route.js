import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { 
  getFinancialTrendData, 
  getPipelineFunnelData, 
  getDealWinLossData,
  getNetWorthTrendData
} from '@/lib/reports';

/**
 * GET /api/reports/financial
 * Returns financial analytics data
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await requireApiAuth();

    const [
      trendData,
      funnelData,
      winLossData,
      netWorthTrend
    ] = await Promise.all([
      getFinancialTrendData(),
      getPipelineFunnelData(),
      getDealWinLossData(),
      getNetWorthTrendData()
    ]);

    return NextResponse.json({
      assetsLiabilitiesTrend: trendData,
      pipelineFunnel: funnelData,
      dealWinLoss: winLossData,
      netWorthTrend: netWorthTrend
    });
  } catch (error) {
    console.error('Error in /api/reports/financial:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial reports' },
      { status: 500 }
    );
  }
}
