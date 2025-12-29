import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

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
