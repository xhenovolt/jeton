/**
 * GET /api/contracts/[id]
 * GET single contract with full payment history and allocation details
 * 
 * PUT /api/contracts/[id]
 * UPDATE contract (limited fields for active contracts)
 * 
 * DELETE /api/contracts/[id]
 * DELETE contract (only if no payments)
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Get contract with client and system info
    const contractResult = await query(
      `SELECT
         c.*,
         cl.name as client_name,
         cl.email as client_email,
         ip.name as system_name
       FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       WHERE c.id = $1`,
      [id]
    );

    if (contractResult.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    const contract = contractResult.rows[0];

    // Get all payments for this contract
    const paymentsResult = await query(
      `SELECT
         p.*,
         COALESCE(SUM(a.amount), 0)::numeric as allocated_amount
       FROM payments p
       LEFT JOIN allocations a ON p.id = a.payment_id
       WHERE p.contract_id = $1
       GROUP BY p.id
       ORDER BY p.date_received DESC`,
      [id]
    );

    const payments = paymentsResult.rows.map(p => ({
      ...p,
      amount_received: parseFloat(p.amount_received),
      allocated_amount: parseFloat(p.allocated_amount),
      remaining: parseFloat(p.amount_received) - parseFloat(p.allocated_amount),
    }));

    // Get allocation details per payment
    const allocationsResult = await query(
      `SELECT
         a.*,
         ec.name as category_name
       FROM allocations a
       WHERE a.payment_id IN (SELECT id FROM payments WHERE contract_id = $1)
       ORDER BY a.created_at DESC`,
      [id]
    );

    const allocations = allocationsResult.rows.map(a => ({
      ...a,
      amount: parseFloat(a.amount),
    }));

    // Calculate metrics
    const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount_received), 0);
    const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);

    return Response.json({
      success: true,
      contract: {
        ...contract,
        installation_fee: parseFloat(contract.installation_fee),
        recurring_amount: contract.recurring_amount ? parseFloat(contract.recurring_amount) : null,
        metrics: {
          total_collected: totalCollected,
          total_allocated: totalAllocated,
          unallocated: totalCollected - totalAllocated,
          payment_count: payments.length,
        },
      },
      payments,
      allocations,
    });
  } catch (error) {
    console.error('Error fetching contract:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      installation_fee,
      recurring_cycle,
      recurring_amount,
      status,
      end_date,
      terms,
    } = body;

    // Fetch existing contract
    const existing = await query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    const contract = existing.rows[0];

    // Business rule: Cannot modify recurring config of active contract
    if (contract.status === 'active' && (recurring_cycle !== undefined || recurring_amount !== undefined)) {
      return Response.json(
        { success: false, error: 'Cannot modify recurring config of active contract' },
        { status: 400 }
      );
    }

    // Update allowed fields
    const updates = [];
    const values = [id];
    let paramIdx = 2;

    if (installation_fee !== undefined) {
      updates.push(`installation_fee = $${paramIdx++}`);
      values.push(installation_fee);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(status);
    }

    if (end_date !== undefined) {
      updates.push(`end_date = $${paramIdx++}`);
      values.push(end_date);
    }

    if (terms !== undefined) {
      updates.push(`terms = $${paramIdx++}`);
      values.push(terms);
    }

    if (updates.length === 0) {
      return Response.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `UPDATE contracts SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return Response.json({
      success: true,
      contract: {
        ...result.rows[0],
        installation_fee: parseFloat(result.rows[0].installation_fee),
        recurring_amount: result.rows[0].recurring_amount ? parseFloat(result.rows[0].recurring_amount) : null,
      },
    });
  } catch (error) {
    console.error('Error updating contract:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if contract has any payments
    const paymentCheck = await query(
      'SELECT COUNT(*) as count FROM payments WHERE contract_id = $1',
      [id]
    );

    if (parseInt(paymentCheck.rows[0].count) > 0) {
      return Response.json(
        {
          success: false,
          error: 'Cannot delete contract with existing payments. Archive instead.',
        },
        { status: 400 }
      );
    }

    // Delete contract
    await query('DELETE FROM contracts WHERE id = $1', [id]);

    return Response.json({
      success: true,
      message: 'Contract deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting contract:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
