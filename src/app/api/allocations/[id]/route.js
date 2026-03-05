/**
 * GET /api/allocations/[id]
 * GET single allocation details
 *
 * DELETE /api/allocations/[id]
 * DELETE allocation (updates payment allocation status automatically via trigger)
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const result = await query(
      `SELECT
         a.*,
         p.amount_received as payment_amount,
         p.contract_id,
         c.client_id,
         cl.name as client_name,
         ip.name as system_name,
         COALESCE(ec.name, a.custom_category) as category_name
       FROM allocations a
       JOIN payments p ON a.payment_id = p.id
       JOIN contracts c ON p.contract_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       LEFT JOIN expense_categories ec ON a.category_id = ec.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Allocation not found' },
        { status: 404 }
      );
    }

    const allocation = result.rows[0];

    return Response.json({
      success: true,
      allocation: {
        ...allocation,
        amount: parseFloat(allocation.amount),
        payment_amount: parseFloat(allocation.payment_amount),
      },
    });
  } catch (error) {
    console.error('Error fetching allocation:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Get allocation to verify
    const allocCheck = await query(
      'SELECT * FROM allocations WHERE id = $1',
      [id]
    );

    if (allocCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Allocation not found' },
        { status: 404 }
      );
    }

    const allocation = allocCheck.rows[0];

    // Delete allocation - trigger will update payment allocation_status
    await query('DELETE FROM allocations WHERE id = $1', [id]);

    return Response.json({
      success: true,
      message: 'Allocation deleted successfully',
      freed_amount: allocation.amount,
    });
  } catch (error) {
    console.error('Error deleting allocation:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
