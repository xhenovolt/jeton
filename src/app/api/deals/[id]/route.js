import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db.js';
import { getBoolSetting } from '@/lib/settings.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';
import { Events } from '@/lib/events.js';
import { logError } from '@/lib/system-logs.js';

// GET /api/deals/[id]
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'deals.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const result = await query(
      `SELECT d.*,
        COALESCE(c.company_name, d.client_name, 'Unknown') as client_label,
        o.name as offering_name,
        s.name as system_name,
        svc.name as service_name,
        (SELECT json_agg(p.* ORDER BY p.payment_date DESC) FROM payments p WHERE p.deal_id = d.id) as payments,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) as paid_amount,
        (SELECT row_to_json(l.*) FROM licenses l WHERE l.deal_id = d.id LIMIT 1) as license
       FROM deals d
       LEFT JOIN clients c ON d.client_id = c.id
       LEFT JOIN offerings o ON d.offering_id = o.id
       LEFT JOIN systems s ON d.system_id = s.id
       LEFT JOIN services svc ON d.service_id = svc.id
       WHERE d.id = $1`, [id]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    const deal = result.rows[0];
    deal.remaining_amount = parseFloat(deal.total_amount) - parseFloat(deal.paid_amount);
    return NextResponse.json({ success: true, data: deal });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch deal' }, { status: 500 });
  }
}

// PUT /api/deals/[id]
export async function PUT(request, { params }) {
  try {
    const perm = await requirePermission(request, 'deals.edit');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;
    const body = await request.json();
    const fields = ['title','description','total_amount','currency','status','system_id','service_id','client_name',
      'start_date','end_date','due_date','invoice_number','invoice_sent_at','invoice_pdf_url','terms','notes','tags','metadata'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(typeof body[f] === 'object' && !Array.isArray(body[f]) ? JSON.stringify(body[f]) : body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    if (body.status === 'completed' || body.status === 'closed_won') updates.push(`closed_at = NOW()`);
    values.push(id);
    const result = await query(`UPDATE deals SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    const deal = result.rows[0];

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'deal', id, JSON.stringify(body)]);

    // AUTO-ISSUE LICENSE: If a system deal is marked closed_won or completed, auto-create a license
    if ((body.status === 'closed_won' || body.status === 'completed') && deal.system_id) {
      try {
        // Validate: log failure loudly instead of silently swallowing it
        if (!deal.system_id) {
          console.warn('[Deals] Auto-license skipped: no system_id on deal', id);
        } else {
          const existing = await query(
            `SELECT id FROM licenses WHERE deal_id = $1 AND status != 'revoked' LIMIT 1`, [id]
          );
          if (!existing.rows.length) {
            const clientLabel = deal.client_name || 'Unknown Client';
            await query(
              `INSERT INTO licenses (system_id, deal_id, client_id, client_name, license_type, issued_date, status, auto_issued)
               VALUES ($1,$2,$3,$4,'lifetime',CURRENT_DATE,'active',true) RETURNING *`,
              [deal.system_id, id, deal.client_id || null, clientLabel]
            );
            await query(
              `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
              [auth.userId, 'AUTO_CREATE', 'license', id,
               JSON.stringify({ source: 'deal_close', system_id: deal.system_id, client: clientLabel })]
            );
          }
        }
      } catch (licErr) {
        // Log to system_logs for visibility (do not fail the deal update)
        console.error('[Deals] license auto-issue error:', licErr.message);
        logError('licenses', 'auto_issue',
          `Auto-license failed for deal ${id}: ${licErr.message}`,
          { deal_id: id, system_id: deal.system_id, error: licErr.message },
          auth.userId, 'deal', id
        ).catch(() => {});
      }
    }

    if (body.status === 'closed_won' || body.status === 'completed') {
      try { await Events.dealClosed(id, deal.title, deal.total_amount, deal.currency, auth.userId); } catch {}
    }
    return NextResponse.json({ success: true, data: deal });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update deal' }, { status: 500 });
  }
}

// DELETE /api/deals/[id]
//
// Whether a deal carrying money may be deleted is an admin policy, held in
// system_settings as `deals_allow_delete_with_payments`:
//
//   off (default) — refuse, so recorded revenue always traces back to a deal.
//   on            — delete, but take the whole money trail with it in one
//                   transaction (ledger entries, invoices, licenses, payments)
//                   so no orphan revenue is left inflating account balances.
//
// The old code deleted payments while leaving their ledger entries behind and
// let invoices fall to ON DELETE SET NULL, which produced exactly the two
// failure modes this policy exists to prevent: invoices belonging to no deal,
// and ledger revenue for payments that no longer exist.
export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'deals.delete');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;

    const dealRow = await query(`SELECT id, title FROM deals WHERE id = $1`, [id]);
    if (!dealRow.rows[0]) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }
    const dealTitle = dealRow.rows[0].title;

    // What is actually attached to this deal?
    const attached = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM payments WHERE deal_id = $1) AS payments,
         (SELECT COUNT(*)::int FROM payments WHERE deal_id = $1 AND status = 'completed') AS completed_payments,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE deal_id = $1 AND status = 'completed') AS completed_total,
         (SELECT COUNT(*)::int FROM invoices WHERE deal_id = $1) AS invoices,
         (SELECT COUNT(*)::int FROM licenses WHERE deal_id = $1) AS licenses,
         (SELECT COUNT(*)::int FROM ledger
            WHERE source_type = 'payment'
              AND source_id IN (SELECT id FROM payments WHERE deal_id = $1)) AS ledger_entries`,
      [id]
    );
    const counts = attached.rows[0];
    const hasMoney = counts.payments > 0 || counts.invoices > 0 || counts.ledger_entries > 0;

    const allowDeleteWithPayments = await getBoolSetting('deals_allow_delete_with_payments');

    if (hasMoney && !allowDeleteWithPayments) {
      return NextResponse.json({
        success: false,
        code: 'DEAL_HAS_PAYMENTS',
        error:
          `"${dealTitle}" has money recorded against it ` +
          `(${counts.payments} payment(s), ${counts.invoices} invoice(s)). ` +
          `Deleting deals with payments is turned off in Settings, so the revenue on record always belongs to a deal.`,
        attached: counts,
      }, { status: 409 });
    }

    // Either there is nothing financial attached, or an admin has explicitly
    // allowed it. Remove the deal and its money trail atomically.
    const removed = await withTransaction(async (tx) => {
      // 1. Ledger has no FK to payments (source_type/source_id only), so its
      //    rows must go first and by hand, or the revenue outlives the payment.
      const ledger = await tx(
        `DELETE FROM ledger
          WHERE source_type = 'payment'
            AND source_id IN (SELECT id FROM payments WHERE deal_id = $1)
        RETURNING id`, [id]);

      // 2. invoices.deal_id is ON DELETE SET NULL, which would leave invoices
      //    attached to no deal — the "unknown client / unknown deal" case.
      //    invoice_items cascade from invoices.
      const invoices = await tx(`DELETE FROM invoices WHERE deal_id = $1 RETURNING id`, [id]);

      // 3. licenses.deal_id is NO ACTION, so it blocks the delete outright.
      const licenses = await tx(`DELETE FROM licenses WHERE deal_id = $1 RETURNING id`, [id]);

      // 4. payments (allocations cascade from here).
      const payments = await tx(`DELETE FROM payments WHERE deal_id = $1 RETURNING id`, [id]);

      // 5. finally the deal itself.
      const deal = await tx(`DELETE FROM deals WHERE id = $1 RETURNING id, title`, [id]);
      if (!deal.rows[0]) throw new Error('Deal disappeared mid-delete');

      return {
        ledger_entries: ledger.rowCount,
        invoices: invoices.rowCount,
        licenses: licenses.rowCount,
        payments: payments.rowCount,
      };
    });

    // Record what was destroyed — this is the only remaining trace of it.
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'deal', id,
       JSON.stringify({
         title: dealTitle,
         removed,
         completed_payment_total: counts.completed_total,
         policy_allowed_money_delete: allowDeleteWithPayments,
       })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: hasMoney
        ? `Deal deleted along with ${removed.payments} payment(s), ${removed.invoices} invoice(s) and ${removed.ledger_entries} ledger entr(ies).`
        : 'Deal deleted',
      removed,
    });
  } catch (error) {
    console.error('[Deals] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete deal' }, { status: 500 });
  }
}
