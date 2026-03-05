/**
 * GET /api/payments
 * LIST all payments with allocation status and contract details
 *
 * POST /api/payments
 * CREATE new payment (must be attached to valid contract)
 * NOTE: Payment is DRAFT until fully allocated
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const contractId = searchParams.get('contractId');
    const status = searchParams.get('status'); // 'pending', 'allocated', 'disputed'
    const unallocatedOnly = searchParams.get('unallocatedOnly') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const offset = (page - 1) * limit;
    const params = [];
    const whereClauses = [];
    let paramIdx = 1;

    if (contractId) {
      whereClauses.push(`p.contract_id = $${paramIdx++}`);
      params.push(contractId);
    }

    if (status) {
      whereClauses.push(`p.allocation_status = $${paramIdx++}`);
      params.push(status);
    }

    if (unallocatedOnly) {
      whereClauses.push('(p.amount_received - p.allocated_amount) > 0.01');
    }

    if (startDate) {
      whereClauses.push(`p.date_received >= $${paramIdx++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push(`p.date_received <= $${paramIdx++}`);
      params.push(endDate);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM payments p ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated payments
    const paymentsResult = await query(
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
       ${whereSQL}
       ORDER BY p.date_received DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      payments: paymentsResult.rows.map(row => ({
        ...row,
        amount_received: parseFloat(row.amount_received),
        allocated_amount: parseFloat(row.allocated_amount),
        unallocated_amount: parseFloat(row.unallocated_amount),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      contract_id,
      amount_received,
      date_received = new Date().toISOString().split('T')[0],
      payment_method = 'other',
      reference_number = null,
      notes = null,
    } = body;

    // Validation: Required fields
    if (!contract_id) {
      return Response.json(
        { success: false, error: 'contract_id is required' },
        { status: 400 }
      );
    }

    if (!amount_received || amount_received <= 0) {
      return Response.json(
        { success: false, error: 'amount_received must be greater than 0' },
        { status: 400 }
      );
    }

    // Validation: Contract exists
    const contractCheck = await query(
      'SELECT id, status FROM contracts WHERE id = $1',
      [contract_id]
    );

    if (contractCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Create payment in PENDING state (not allocated yet)
    const result = await query(
      `INSERT INTO payments (
         contract_id, amount_received, date_received, 
         payment_method, reference_number, notes, allocation_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [contract_id, amount_received, date_received, payment_method, reference_number, notes, 'pending']
    );

    const payment = result.rows[0];

    return Response.json(
      {
        success: true,
        message: 'Payment created. Must allocate before finalization.',
        payment: {
          ...payment,
          amount_received: parseFloat(payment.amount_received),
          allocated_amount: parseFloat(payment.allocated_amount),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating payment:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
