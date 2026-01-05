import { executeBuyback } from '@/lib/shares.js';
import { logAudit } from '@/lib/audit.js';

/**
 * POST /api/equity/buyback
 * Execute share buyback
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      shareholder_id,
      shares_repurchased,
      buyback_price_per_share,
      reason,
    } = body;

    // Validate required fields
    if (!shareholder_id || !shares_repurchased || shares_repurchased <= 0) {
      return Response.json(
        { success: false, error: 'Invalid buyback parameters' },
        { status: 400 }
      );
    }

    // Execute buyback
    const result = await executeBuyback({
      shareholder_id,
      shares_repurchased,
      buyback_price_per_share,
      reason,
    });

    // Log action
    await logAudit({
      action: 'BUYBACK_SHARES',
      module: 'EQUITY',
      description: `Bought back ${shares_repurchased} shares from shareholder at ${buyback_price_per_share} per share`,
      metadata: result,
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error executing buyback:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
