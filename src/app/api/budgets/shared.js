/**
 * Shared pieces for /api/budgets and /api/budgets/[id].
 *
 * BUDGET_SELECT reads v_budget_utilization and exposes the field names the
 * UI uses: `id` and `amount` alongside the view's own `budget_id` and
 * `budgeted`. The view's naming used to leak straight to the client, which
 * left every budget id undefined (edit/delete hit /api/budgets/undefined,
 * and the Expenses page could not link an expense to a budget) and every
 * limit at 0.
 */

import { z } from 'zod';

export const BUDGET_SELECT = `
  SELECT v.*,
         v.budget_id AS id,
         v.budgeted  AS amount,
         (SELECT COUNT(*)::int FROM expenses e
           WHERE e.budget_id = v.budget_id
             AND e.status NOT IN ('void', 'rejected')
             AND e.expense_date BETWEEN v.start_date AND v.end_date) AS expense_count
    FROM v_budget_utilization v`;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD');

const fields = {
  name:            z.string().trim().min(1, 'Name is required').max(255),
  category:        z.string().trim().min(1).max(100),
  amount:          z.coerce.number().positive('Amount must be greater than 0'),
  currency:        z.string().trim().length(3, 'Currency must be a 3-letter code').toUpperCase(),
  period:          z.enum(['monthly', 'quarterly', 'yearly', 'custom']),
  start_date:      isoDate,
  end_date:        isoDate,
  alert_threshold: z.coerce.number().min(0).max(100),
  notes:           z.string().max(5000).nullable(),
  is_active:       z.boolean(),
};

const endAfterStart = b => !b.start_date || !b.end_date || b.end_date > b.start_date;
const endAfterStartMsg = { message: 'Period end must be after period start', path: ['end_date'] };

export const BudgetCreate = z.object({
  ...fields,
  // budgets.category is NOT NULL; a budget without a specific category is "other".
  category:        fields.category.default('other'),
  currency:        fields.currency.default('UGX'),
  period:          fields.period.default('custom'),
  alert_threshold: fields.alert_threshold.default(80),
  notes:           fields.notes.optional(),
  is_active:       fields.is_active.optional(),
}).refine(endAfterStart, endAfterStartMsg);

export const BudgetUpdate = z.object(fields).partial().refine(endAfterStart, endAfterStartMsg)
  .refine(b => Object.keys(b).length > 0, { message: 'No fields to update' });
