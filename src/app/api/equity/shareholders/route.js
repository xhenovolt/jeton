/**
 * GET/POST /api/equity/shareholders
 * Get all shareholders or add new shareholder
 */

import { getCapTable, addShareholder, getShareholder } from '@/lib/equity.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const shareholderId = searchParams.get('id');

    if (shareholderId) {
      // Get specific shareholder
      const shareholder = await getShareholder(shareholderId);
      if (!shareholder) {
        return Response.json(
          { success: false, error: 'Shareholder not found' },
          { status: 404 }
        );
      }
      return Response.json({
        success: true,
        data: shareholder,
      });
    }

    // Get all shareholders
    const capTable = await getCapTable();
    return Response.json({
      success: true,
      data: capTable,
      count: capTable.length,
    });
  } catch (error) {
    console.error('Shareholders GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      shareholder_id,
      shareholder_name,
      shareholder_email,
      shares_owned,
      holder_type,
      acquisition_price,
      share_class,
      equity_type = 'PURCHASED',
    } = body;

    if (!shareholder_id || !shareholder_name || !shares_owned) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (shares_owned <= 0) {
      return Response.json(
        { success: false, error: 'Shares owned must be positive' },
        { status: 400 }
      );
    }

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      return Response.json(
        { success: false, error: 'Invalid equity_type. Must be PURCHASED or GRANTED.' },
        { status: 400 }
      );
    }

    const shareholder = await addShareholder({
      shareholder_id,
      shareholder_name,
      shareholder_email,
      shares_owned,
      holder_type: holder_type || 'investor',
      acquisition_price,
      share_class: share_class || 'Common',
      equity_type,
    });

    return Response.json(
      {
        success: true,
        message: 'Shareholder added',
        data: shareholder,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Shareholders POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
