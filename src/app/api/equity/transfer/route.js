/**
 * POST /api/equity/transfer
 * Execute share transfer between shareholders (no dilution)
 */

import { executeShareTransfer } from '@/lib/equity.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      from_shareholder_id,
      to_shareholder_id,
      shares_transferred,
      transfer_price_per_share,
      transfer_type,
      equity_type = 'PURCHASED',
      reason,
    } = body;

    if (!from_shareholder_id || !to_shareholder_id || !shares_transferred) {
      return Response.json(
        { success: false, error: 'Missing required transfer parameters' },
        { status: 400 }
      );
    }

    if (shares_transferred <= 0) {
      return Response.json(
        { success: false, error: 'Shares transferred must be positive' },
        { status: 400 }
      );
    }

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      return Response.json(
        { success: false, error: 'Invalid equity_type. Must be PURCHASED or GRANTED.' },
        { status: 400 }
      );
    }

    const result = await executeShareTransfer({
      from_shareholder_id,
      to_shareholder_id,
      shares_transferred,
      transfer_price_per_share,
      transfer_type: transfer_type || 'secondary-sale',
      equity_type,
      reason,
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: true,
        message: result.message,
        data: {
          from_new_balance: result.from_new_balance,
          to_new_balance: result.to_new_balance,
          shares_transferred,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Share transfer POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
