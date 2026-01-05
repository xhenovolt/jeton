/**
 * PUT/DELETE /api/shares/allocations/[id]
 * Update or delete share allocation
 */

import { query } from '@/lib/db.js';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      owner_name,
      owner_email,
      shares_allocated,
      vesting_start_date,
      vesting_end_date,
      vesting_percentage,
      notes,
    } = body;

    // Get current allocation
    const currentResult = await query(
      'SELECT shares_allocated FROM share_allocations WHERE id = $1',
      [id]
    );

    if (currentResult.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Allocation not found' },
        { status: 404 }
      );
    }

    const oldShares = parseInt(currentResult.rows[0].shares_allocated);
    const newShares = parseInt(shares_allocated || oldShares);
    const shareDifference = newShares - oldShares;

    // Check if update is valid
    if (shareDifference > 0) {
      const availableResult = await query(`
        SELECT s.total_shares, COALESCE(SUM(sa.shares_allocated), 0) as allocated
        FROM shares s
        LEFT JOIN share_allocations sa ON sa.status = 'active' AND sa.id != $1
        GROUP BY s.total_shares
      `, [id]);

      const totalShares = parseInt(availableResult.rows[0]?.total_shares || 0);
      const allocated = parseInt(availableResult.rows[0]?.allocated || 0);

      if (allocated + newShares > totalShares) {
        return Response.json(
          {
            success: false,
            error: `Cannot allocate ${newShares} shares. Only ${totalShares - allocated} shares available.`,
          },
          { status: 400 }
        );
      }
    }

    const result = await query(
      `
      UPDATE share_allocations
      SET 
        owner_name = $1,
        owner_email = $2,
        shares_allocated = $3,
        vesting_start_date = $4,
        vesting_end_date = $5,
        vesting_percentage = $6,
        notes = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
      `,
      [
        owner_name,
        owner_email || null,
        newShares,
        vesting_start_date || null,
        vesting_end_date || null,
        vesting_percentage || 100,
        notes || null,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Failed to update allocation' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Share allocation PUT error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const result = await query(
      `
      UPDATE share_allocations
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json(
        { success: false, error: 'Allocation not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: 'Allocation deactivated',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Share allocation DELETE error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
