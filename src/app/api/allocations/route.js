/**
 * GET /api/allocations
 * LIST all allocations across all payments, with filtering
 *
 * POST /api/allocations
 * CREATE new allocation for a payment
 * MUST enforce: SUM(allocations) <= payment.amount_received
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const paymentId = searchParams.get('paymentId');
    const allocationType = searchParams.get('allocationType');
    const categoryId = searchParams.get('categoryId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const offset = (page - 1) * limit;
    const params = [];
    const whereClauses = [];
    let paramIdx = 1;

    if (paymentId) {
      whereClauses.push(`a.payment_id = $${paramIdx++}`);
      params.push(paymentId);
    }

    if (allocationType) {
      whereClauses.push(`a.allocation_type = $${paramIdx++}`);
      params.push(allocationType);
    }

    if (categoryId) {
      whereClauses.push(`a.category_id = $${paramIdx++}`);
      params.push(categoryId);
    }

    if (startDate) {
      whereClauses.push(`a.created_at >= $${paramIdx++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push(`a.created_at <= $${paramIdx++}`);
      params.push(endDate);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count
    const countResult = await query(
      `SELECT COUNT(*) FROM allocations a ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get allocations
    const allocationsResult = await query(
      `SELECT
         a.*,
         p.amount_received as payment_amount,
         cl.name as client_name,
         COALESCE(ec.name, a.custom_category) as category_name
       FROM allocations a
       JOIN payments p ON a.payment_id = p.id
       JOIN contracts c ON p.contract_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN expense_categories ec ON a.category_id = ec.id
       ${whereSQL}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      allocations: allocationsResult.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount),
        payment_amount: parseFloat(row.payment_amount),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching allocations:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      payment_id,
      allocation_type,
      category_id = null,
      custom_category = null,
      amount,
      description = null,
    } = body;

    // Validation: Required fields
    if (!payment_id) {
      return Response.json(
        { success: false, error: 'payment_id is required' },
        { status: 400 }
      );
    }

    if (!allocation_type) {
      return Response.json(
        { success: false, error: 'allocation_type is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return Response.json(
        { success: false, error: 'amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validation: Valid allocation_type
    const validTypes = ['operating', 'vault', 'expense', 'investment', 'custom'];
    if (!validTypes.includes(allocation_type)) {
      return Response.json(
        { success: false, error: `allocation_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validation: Payment exists
    const paymentCheck = await query(
      'SELECT id, amount_received, allocated_amount FROM payments WHERE id = $1',
      [payment_id]
    );

    if (paymentCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    const payment = paymentCheck.rows[0];
    const amountReceived = parseFloat(payment.amount_received);
    const currentAllocated = parseFloat(payment.allocated_amount);

    // Validation: Allocation doesn't exceed payment amount
    if (currentAllocated + amount > amountReceived + 0.01) { // Small tolerance for floating point
      return Response.json(
        {
          success: false,
          error: `Allocation would exceed payment amount. Payment: ${amountReceived}, Currently allocated: ${currentAllocated}, Requested: ${amount}, Remaining: ${amountReceived - currentAllocated}`,
        },
        { status: 400 }
      );
    }

    // Validation: Category exists if category_id provided
    if (category_id) {
      const categoryCheck = await query(
        'SELECT id FROM expense_categories WHERE id = $1',
        [category_id]
      );
      if (categoryCheck.rows.length === 0) {
        return Response.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Create allocation
    const result = await query(
      `INSERT INTO allocations (
         payment_id, allocation_type, category_id, custom_category, amount, description
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [payment_id, allocation_type, category_id, custom_category, amount, description]
    );

    return Response.json(
      {
        success: true,
        allocation: {
          ...result.rows[0],
          amount: parseFloat(result.rows[0].amount),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating allocation:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
