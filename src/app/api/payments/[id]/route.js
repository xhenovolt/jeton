/**
 * GET /api/payments/[id]
 * GET single payment with all allocations and remaining unallocated amount
 *
 * DELETE /api/payments/[id]
 * DELETE payment (only if unallocated)
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Get payment with contract info
    const paymentResult = await query(
      `SELECT
         p.*,
         c.client_id,
         cl.name as client_name,
         ip.name as system_name,
         (p.amount_received - p.allocated_amount)::numeric as unallocated_amount
       FROM payments p
       JOIN contracts c ON p.contract_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       WHERE p.id = $1`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    const payment = paymentResult.rows[0];

    // Get all allocations for this payment
    const allocationsResult = await query(
      `SELECT
         a.*,
         COALESCE(ec.name, a.custom_category) as category_name
       FROM allocations a
       LEFT JOIN expense_categories ec ON a.category_id = ec.id
       WHERE a.payment_id = $1
       ORDER BY a.created_at DESC`,
      [id]
    );

    const allocations = allocationsResult.rows.map(a => ({
      ...a,
      amount: parseFloat(a.amount),
    }));

    // Get approval/audit info
    const metaResult = await query(
      `SELECT 
         COUNT(*) as total_allocations,
         SUM(amount)::numeric as total_allocated,
         JSON_AGG(
           JSON_BUILD_OBJECT('type', allocation_type, 'count', COUNT(*)) 
         ) as by_type
       FROM allocations
       WHERE payment_id = $1
       GROUP BY payment_id`,
      [id]
    );

    const auditInfo = metaResult.rows.length > 0 ? metaResult.rows[0] : 
      { total_allocations: 0, total_allocated: 0, by_type: null };

    return Response.json({
      success: true,
      payment: {
        ...payment,
        amount_received: parseFloat(payment.amount_received),
        allocated_amount: parseFloat(payment.allocated_amount),
        unallocated_amount: parseFloat(payment.unallocated_amount),
      },
      allocations,
      audit: {
        ...auditInfo,
        total_allocated: auditInfo.total_allocated ? parseFloat(auditInfo.total_allocated) : 0,
        is_fully_allocated: Math.abs(parseFloat(payment.unallocated_amount)) < 0.01,
      },
    });
  } catch (error) {
    console.error('Error fetching payment:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if payment has allocations
    const allocCheck = await query(
      'SELECT COUNT(*) as count FROM allocations WHERE payment_id = $1',
      [id]
    );

    if (parseInt(allocCheck.rows[0].count) > 0) {
      return Response.json(
        {
          success: false,
          error: 'Cannot delete payment with allocations. Delete allocations first.',
        },
        { status: 400 }
      );
    }

    // Get payment to verify
    const paymentCheck = await query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (paymentCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Delete payment
    await query('DELETE FROM payments WHERE id = $1', [id]);

    return Response.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
