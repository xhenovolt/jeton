import { withRoute, ok } from '@/lib/api/route.js';
import { query } from '@/lib/db.js';
import { BUDGET_SELECT, BudgetCreate } from './shared.js';

// GET /api/budgets — every budget with live utilisation
export const GET = withRoute({ permission: 'budgets.view' }, async () => {
  const { rows } = await query(`${BUDGET_SELECT} ORDER BY v.start_date DESC`);
  return ok(rows);
});

// POST /api/budgets
export const POST = withRoute({ permission: 'budgets.create', body: BudgetCreate }, async ({ auth, body }) => {
  const { rows } = await query(
    `INSERT INTO budgets (name, category, amount, currency, period, start_date, end_date, alert_threshold, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [body.name, body.category, body.amount, body.currency, body.period, body.start_date, body.end_date,
     body.alert_threshold, body.notes ?? null, auth.userId]
  );
  const created = await query(`${BUDGET_SELECT} WHERE v.budget_id = $1`, [rows[0].id]);
  return ok(created.rows[0], { status: 201 });
});
