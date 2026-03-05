/**
 * GET /api/expenses
 * LIST all expenses with category filtering
 *
 * POST /api/expenses
 * CREATE new expense (can be linked to allocation or standalone)
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const categoryId = searchParams.get('categoryId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const linkedOnly = searchParams.get('linkedOnly') === 'true';

    const offset = (page - 1) * limit;
    const params = [];
    const whereClauses = [];
    let paramIdx = 1;

    if (categoryId) {
      whereClauses.push(`e.category_id = $${paramIdx++}`);
      params.push(categoryId);
    }

    if (linkedOnly) {
      whereClauses.push('e.linked_allocation_id IS NOT NULL');
    }

    if (startDate) {
      whereClauses.push(`e.expense_date >= $${paramIdx++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push(`e.expense_date <= $${paramIdx++}`);
      params.push(endDate);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count
    const countResult = await query(
      `SELECT COUNT(*) FROM expenses e ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get expenses
    const expensesResult = await query(
      `SELECT
         e.*,
         ec.name as category_name,
         ec.is_system_defined,
         a.allocation_type,
         a.amount as allocation_amount
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.id
       LEFT JOIN allocations a ON e.linked_allocation_id = a.id
       ${whereSQL}
       ORDER BY e.expense_date DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      expenses: expensesResult.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount),
        allocation_amount: row.allocation_amount ? parseFloat(row.allocation_amount) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching expenses:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      category_id,
      amount,
      expense_date = new Date().toISOString().split('T')[0],
      description = null,
      payment_method = null,
      reference_number = null,
      linked_allocation_id = null,
    } = body;

    // Validation: Required fields
    if (!category_id) {
      return Response.json(
        { success: false, error: 'category_id is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return Response.json(
        { success: false, error: 'amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validation: Category exists
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

    // Validation: If linked_allocation_id provided, it must exist
    if (linked_allocation_id) {
      const allocCheck = await query(
        'SELECT id, amount FROM allocations WHERE id = $1',
        [linked_allocation_id]
      );
      if (allocCheck.rows.length === 0) {
        return Response.json(
          { success: false, error: 'Allocation not found' },
          { status: 404 }
        );
      }

      // Best practice: expense amount should match or be <= allocation amount
      const allocAmount = parseFloat(allocCheck.rows[0].amount);
      if (amount > allocAmount) {
        console.warn(
          `Expense (${amount}) exceeds linked allocation (${allocAmount}). This is allowed but may indicate data inconsistency.`
        );
      }
    }

    // Create expense
    const result = await query(
      `INSERT INTO expenses (
         category_id, amount, expense_date, description,
         payment_method, reference_number, linked_allocation_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        category_id,
        amount,
        expense_date,
        description,
        payment_method,
        reference_number,
        linked_allocation_id,
      ]
    );

    return Response.json(
      {
        success: true,
        expense: {
          ...result.rows[0],
          amount: parseFloat(result.rows[0].amount),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating expense:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
