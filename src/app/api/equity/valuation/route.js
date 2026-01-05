import { query } from '@/lib/db.js';
import { recordValuationRound, getCurrentValuation, getSharesConfiguration } from '@/lib/shares.js';
import { logAudit } from '@/lib/audit.js';

/**
 * GET /api/equity/valuation
 * Get current company valuation
 */
export async function GET() {
  try {
    const valuation = await getCurrentValuation();
    const config = await getSharesConfiguration();

    return Response.json({
      success: true,
      data: {
        ...valuation,
        shares_config: config,
      },
    });
  } catch (error) {
    console.error('Error fetching valuation:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/equity/valuation
 * Record new valuation round
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      pre_money_valuation,
      investment_amount,
      round_name,
      investor_name,
      notes,
    } = body;

    // Validate required fields
    if (!pre_money_valuation || !investment_amount) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Record valuation
    const result = await recordValuationRound({
      pre_money_valuation,
      investment_amount,
      round_name,
      investor_name,
      notes,
    });

    // Log action
    await logAudit({
      action: 'CREATE_VALUATION',
      module: 'EQUITY',
      description: `Recorded ${round_name || 'new'} valuation round: ${pre_money_valuation} pre-money`,
      metadata: result,
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating valuation:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
