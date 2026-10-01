import { describe, it, expect } from 'vitest';
import { BudgetCreate, BudgetUpdate, BUDGET_SELECT } from '@/app/api/budgets/shared.js';

const base = { name: 'Q1 Marketing', amount: '500000', start_date: '2026-01-01', end_date: '2026-03-31' };

describe('BudgetCreate', () => {
  it('fills NOT NULL defaults the old form left empty (category was the silent failure)', () => {
    const r = BudgetCreate.parse(base);
    expect(r).toMatchObject({ category: 'other', currency: 'UGX', period: 'custom', alert_threshold: 80, amount: 500000 });
  });

  it('rejects an end date on or before the start date (DB check constraint)', () => {
    const r = BudgetCreate.safeParse({ ...base, end_date: '2026-01-01' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/after period start/);
  });

  it('rejects non-positive amounts and bad periods', () => {
    expect(BudgetCreate.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(BudgetCreate.safeParse({ ...base, period: 'weekly' }).success).toBe(false);
  });
});

describe('BudgetUpdate', () => {
  it('accepts partial updates and refuses empty ones', () => {
    expect(BudgetUpdate.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
    expect(BudgetUpdate.safeParse({}).success).toBe(false);
  });

  it('cannot smuggle unknown columns into the UPDATE', () => {
    expect(BudgetUpdate.parse({ name: 'x', created_by: 'evil', id: 'y' })).toEqual({ name: 'x' });
  });
});

describe('BUDGET_SELECT', () => {
  it('exposes the id/amount fields the UI reads', () => {
    expect(BUDGET_SELECT).toMatch(/budget_id AS id/);
    expect(BUDGET_SELECT).toMatch(/budgeted\s+AS amount/);
  });
});
