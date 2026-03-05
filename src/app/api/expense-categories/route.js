/**
 * GET /api/expense-categories
 * LIST all expense categories (system-defined + custom)
 *
 * POST /api/expense-categories
 * CREATE custom expense category
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const systemOnly = searchParams.get('systemOnly') === 'true';

    let whereClause = '';
    if (systemOnly) {
      whereClause = 'WHERE is_system_defined = true';
    }

    const result = await query(
      `SELECT * FROM expense_categories
       ${whereClause}
       ORDER BY is_system_defined DESC, name ASC`
    );

    return Response.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error('Error fetching expense categories:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description = null } = body;

    if (!name) {
      return Response.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await query(
      'SELECT id FROM expense_categories WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (existing.rows.length > 0) {
      return Response.json(
        { success: false, error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO expense_categories (name, description, is_system_defined, created_at)
       VALUES ($1, $2, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [name, description]
    );

    return Response.json(
      { success: true, category: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating expense category:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
