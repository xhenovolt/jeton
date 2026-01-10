import { 
  getExecutiveSummary,
  getTopAssets,
  getTopLiabilities
} from '@/lib/reports';

/**
 * GET /api/reports/executive
 * Returns executive dashboard summary
 */
export async function GET(request) {
  try {
    const [
      summary,
      topAssets,
      topLiabilities
    ] = await Promise.all([
      getExecutiveSummary(),
      getTopAssets(5),
      getTopLiabilities(5)
    ]);

    return Response.json({
      success: true,
      data: {
        summary,
        topAssets,
        topLiabilities,
      },
    });
  } catch (error) {
    console.error('Error in /api/reports/executive:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch executive report' },
      { status: 500 }
    );
  }
}
