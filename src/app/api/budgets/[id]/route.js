import { withRoute, ok, fail } from '@/lib/api/route.js';
import { query, withTransaction } from '@/lib/db.js';
import { BUDGET_SELECT, BudgetUpdate } from '../shared.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/budgets/:id — budget + its expenses
export const GET = withRoute({ permission: 'budgets.view' }, async ({ params }) => {
  if (!UUID_RE.test(params.id)) return fail(400, 'Invalid budget id');
  const budget = await query(`${BUDGET_SELECT} WHERE v.budget_id = $1`, [params.id]);
  if (!budget.rows[0]) return fail(404, 'Budget not found');
  const expenses = await query(
    `SELECT e.*, a.name AS account_name
       FROM expenses e JOIN accounts a ON e.account_id = a.id
      WHERE e.budget_id = $1
      ORDER BY e.expense_date DESC`,
    [params.id]
  );
  return ok({ ...budget.rows[0], expenses: expenses.rows });
});

// PUT /api/budgets/:id
export const PUT = withRoute({ permission: 'budgets.update', body: BudgetUpdate }, async ({ params, body }) => {
  if (!UUID_RE.test(params.id)) return fail(400, 'Invalid budget id');
  const cols = Object.keys(body);
  const values = cols.map(c => body[c]);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  sets.push('updated_at = NOW()');
  const result = await query(
    `UPDATE budgets SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING id`,
    [...values, params.id]
  );
  if (!result.rows[0]) return fail(404, 'Budget not found');
  const updated = await query(`${BUDGET_SELECT} WHERE v.budget_id = $1`, [params.id]);
  return ok(updated.rows[0]);
});

// DELETE /api/budgets/:id — unlinks its expenses, then deletes (atomically)
export const DELETE = withRoute({ permission: 'budgets.delete' }, async ({ params }) => {
  if (!UUID_RE.test(params.id)) return fail(400, 'Invalid budget id');
  const deleted = await withTransaction(async tx => {
    await tx(`UPDATE expenses SET budget_id = NULL WHERE budget_id = $1`, [params.id]);
    const r = await tx(`DELETE FROM budgets WHERE id = $1 RETURNING id`, [params.id]);
    return r.rows[0];
  });
  if (!deleted) return fail(404, 'Budget not found');
  return ok({ id: deleted.id });
});
