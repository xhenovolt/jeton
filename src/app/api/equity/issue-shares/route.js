import { issueNewShares, getSharesConfiguration } from '@/lib/shares.js';
import { logAudit } from '@/lib/audit.js';

/**
 * POST /api/equity/issue-shares
 * Issue new shares to a shareholder
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      to_shareholder_id,
      shares_amount,
      equity_type = 'GRANTED',
      vesting_start_date,
      vesting_end_date,
      vesting_percentage = 100,
      purchase_price,
      reason,
    } = body;

    // Validate required fields
    if (!to_shareholder_id || !shares_amount || shares_amount <= 0) {
      return Response.json(
        { success: false, error: 'Invalid issuance parameters' },
        { status: 400 }
      );
    }

    // Validate GRANTED equity has vesting dates
    if (equity_type === 'GRANTED' && !vesting_end_date) {
      return Response.json(
        { success: false, error: 'GRANTED equity requires vesting_end_date' },
        { status: 400 }
      );
    }

    // Issue shares
    const result = await issueNewShares({
      to_shareholder_id,
      shares_amount,
      equity_type,
      vesting_start_date,
      vesting_end_date,
      vesting_percentage,
      purchase_price,
      reason,
    });

    // Log action
    await logAudit({
      action: 'ISSUE_SHARES',
      module: 'EQUITY',
      description: `Issued ${shares_amount} ${equity_type} shares to shareholder ${to_shareholder_id}`,
      metadata: result,
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error issuing shares:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/equity/issue-shares
 * Get shares configuration (available capacity)
 */
export async function GET() {
  try {
    const config = await getSharesConfiguration();

    return Response.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error getting shares config:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
