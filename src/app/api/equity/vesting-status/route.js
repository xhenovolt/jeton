import { getVestingProgress, calculateVestedShares } from '@/lib/shares.js';
import { logAudit } from '@/lib/audit.js';

/**
 * GET /api/equity/vesting-status
 * Get vesting information for a shareholder
 * Query params: ?shareholder_id=<id>
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const shareholderId = searchParams.get('shareholder_id');

    if (!shareholderId) {
      return Response.json(
        { success: false, error: 'shareholder_id is required' },
        { status: 400 }
      );
    }

    const vestingInfo = await getVestingProgress(shareholderId);

    return Response.json({
      success: true,
      data: vestingInfo,
    });
  } catch (error) {
    console.error('Error fetching vesting status:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
