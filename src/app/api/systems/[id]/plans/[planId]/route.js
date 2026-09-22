import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// Columns a caller may change. Anything else in the body is ignored.
const NUMERIC = new Set(['installation_fee', 'monthly_fee', 'annual_fee']);
const EDITABLE = [
  'name', 'description', 'installation_fee', 'monthly_fee', 'annual_fee',
  'currency', 'billing_cycle', 'features', 'max_users', 'is_active', 'sort_order',
];

function coerce(field, value) {
  if (value === '' || value === null || value === undefined) return null;
  if (NUMERIC.has(field)) return parseFloat(value);
  if (field === 'max_users' || field === 'sort_order') return parseInt(value, 10);
  if (field === 'features') return JSON.stringify(Array.isArray(value) ? value : []);
  return value;
}

// PUT /api/systems/[id]/plans/[planId] — update a pricing plan
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id, planId } = await params;
    const body = await request.json();

    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ success: false, error: 'name cannot be empty' }, { status: 400 });
    }

    const updates = [];
    const values = [];
    for (const field of EDITABLE) {
      if (body[field] === undefined) continue;
      values.push(coerce(field, body[field]));
      updates.push(`${field} = $${values.length}`);
    }
    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }
    updates.push('updated_at = NOW()');

    values.push(planId, id);
    const result = await query(
      `UPDATE system_pricing_plans SET ${updates.join(', ')}
       WHERE id = $${values.length - 1} AND system_id = $${values.length}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Plan not found for this system' }, { status: 404 });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'system_pricing_plan', planId, JSON.stringify(body)]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Plans] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 });
  }
}

// DELETE /api/systems/[id]/plans/[planId] — remove a plan no deal depends on
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'systems.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id, planId } = await params;

    // deals.plan_id references this table. Deleting a plan that deals point at
    // would either raise a FK violation or silently orphan pricing history, so
    // refuse and steer the caller to deactivation instead.
    const inUse = await query(`SELECT COUNT(*)::int AS n FROM deals WHERE plan_id = $1`, [planId]);
    if (inUse.rows[0].n > 0) {
      return NextResponse.json({
        success: false,
        error: `This plan is attached to ${inUse.rows[0].n} deal(s). Deactivate it instead so it stops appearing on new deals while existing deals keep their pricing.`,
        code: 'PLAN_IN_USE',
        deals: inUse.rows[0].n,
      }, { status: 409 });
    }

    const result = await query(
      `DELETE FROM system_pricing_plans WHERE id = $1 AND system_id = $2 RETURNING id, name`,
      [planId, id]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: 'Plan not found for this system' }, { status: 404 });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'system_pricing_plan', planId,
       JSON.stringify({ system_id: id, name: result.rows[0].name })]
    );

    return NextResponse.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    console.error('[Plans] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete plan' }, { status: 500 });
  }
}
