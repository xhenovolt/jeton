/**
 * GET /api/expenses/[id]
 * GET single expense details
 *
 * PUT /api/expenses/[id]
 * UPDATE expense
 *
 * DELETE /api/expenses/[id]
 * DELETE expense
 */

import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const result = await query(
      `SELECT
         e.*,
         ec.name as category_name,
         ec.is_system_defined,
         a.allocation_type,
         a.amount as allocation_amount,
         p.amount_received as payment_amount,
         c.client_id,
         cl.name as client_name
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.id
       LEFT JOIN allocations a ON e.linked_allocation_id = a.id
       LEFT JOIN payments p ON a.payment_id = p.id
       LEFT JOIN contracts c ON p.contract_id = c.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      );
    }

    const expense = result.rows[0];

    return Response.json({
      success: true,
      expense: {
        ...expense,
        amount: parseFloat(expense.amount),
        allocation_amount: expense.allocation_amount ? parseFloat(expense.allocation_amount) : null,
        payment_amount: expense.payment_amount ? parseFloat(expense.payment_amount) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching expense:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { category_id, amount, expense_date, description } = body;

    // Fetch existing
    const existing = await query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      );
    }

    const updates = [];
    const values = [id];
    let paramIdx = 2;

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
      updates.push(`category_id = $${paramIdx++}`);
      values.push(category_id);
    }

    if (amount !== undefined && amount > 0) {
      updates.push(`amount = $${paramIdx++}`);
      values.push(amount);
    }

    if (expense_date) {
      updates.push(`expense_date = $${paramIdx++}`);
      values.push(expense_date);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return Response.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const result = await query(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return Response.json({
      success: true,
      expense: {
        ...result.rows[0],
        amount: parseFloat(result.rows[0].amount),
      },
    });
  } catch (error) {
    console.error('Error updating expense:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const expenseCheck = await query(
      'SELECT * FROM expenses WHERE id = $1',
      [id]
    );

    if (expenseCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      );
    }

    await query('DELETE FROM expenses WHERE id = $1', [id]);

    return Response.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting expense:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
