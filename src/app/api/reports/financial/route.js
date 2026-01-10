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

    return Response.json({
      success: true,
      data: {
        assetsLiabilitiesTrend: trendData,
        pipelineFunnel: funnelData,
        dealWinLoss: winLossData,
        netWorthTrend: netWorthTrend,
      },
    });
  } catch (error) {
    console.error('Error in /api/reports/financial:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch financial reports' },
      { status: 500 }
    );
  }
}
