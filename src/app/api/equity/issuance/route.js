/**
 * GET/POST /api/equity/issuance
 * Get pending issuances or propose new issuance
 */

import { query } from '@/lib/db.js';
import { proposeShareIssuance, executeShareIssuance } from '@/lib/equity.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const id = searchParams.get('id');

    let queryStr = `
      SELECT
        id,
        shares_issued,
        issued_at_price,
        recipient_id,
        recipient_type,
        issuance_reason,
        issuance_type,
        approval_status,
        confirmation_received,
        previous_issued_shares,
        ownership_dilution_impact,
        created_by_id,
        created_at,
        approved_by_id,
        approved_at,
        issued_at,
        notes
      FROM share_issuances
    `;

    let params = [];

    if (id) {
      queryStr += ' WHERE id = $1';
      params.push(id);
    } else {
      queryStr += ' WHERE approval_status = $1 ORDER BY created_at DESC';
      params.push(status);
    }

    const result = await query(queryStr, params);

    if (id && result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Issuance not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: id ? result.rows[0] : result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Issuance GET error:', error);
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
      shares_issued,
      issued_at_price,
      recipient_id,
      recipient_type,
      issuance_reason,
      issuance_type,
      equity_type = 'GRANTED',
      created_by_id,
      action, // 'propose' or 'approve'
      issuance_id, // for approve action
      approved_by_id,
    } = body;

    if (action === 'approve') {
      // Execute issuance
      if (!issuance_id || !approved_by_id) {
        return Response.json(
          { success: false, error: 'Missing issuance_id or approved_by_id' },
          { status: 400 }
        );
      }

      const result = await executeShareIssuance(issuance_id, approved_by_id);
      return Response.json({
        success: true,
        message: result.message,
        data: result,
      });
    }

    // Default: Propose new issuance
    if (!shares_issued || !created_by_id) {
      return Response.json(
        { success: false, error: 'Missing required issuance parameters' },
        { status: 400 }
      );
    }

    if (shares_issued <= 0) {
      return Response.json(
        { success: false, error: 'Shares issued must be positive' },
        { status: 400 }
      );
    }

    if (!['PURCHASED', 'GRANTED'].includes(equity_type)) {
      return Response.json(
        { success: false, error: 'Invalid equity_type. Must be PURCHASED or GRANTED.' },
        { status: 400 }
      );
    }

    const result = await proposeShareIssuance({
      shares_issued,
      issued_at_price,
      recipient_id,
      recipient_type,
      issuance_reason,
      issuance_type: issuance_type || 'equity',
      equity_type,
      created_by_id,
    });

    return Response.json(
      {
        success: true,
        message: 'Share issuance proposed - awaiting founder approval',
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Issuance POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
