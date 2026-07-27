import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import crypto from 'crypto';

/**
 * POST /api/invoices/reconcile
 *
 * Walks every 'Won'/'completed'/'closed' deal without a linked invoice
 * and creates one. Idempotent — re-running only picks up newly-won
 * deals; existing invoices stay untouched. Every generated row is
 * marked source='auto_reconciled' so historical drift is auditable.
 *
 * Superadmin only (via invoices.manage). Superadmin bypasses.
 *
 * Body (optional): { dry_run: boolean }  — if true, returns the list
 * of deals that WOULD be invoiced without writing anything.
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'invoices.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Everything that's clearly "closed as sold" and isn't already
    // linked to an invoice.
    const candidates = await query(
      `SELECT d.id, d.title, d.value_estimate, d.currency, d.client_id, d.client_name,
              d.expected_close_date, d.created_at, d.updated_at,
              d.system_id, d.stage,
              COALESCE(
                (SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'confirmed'),
                0
              ) AS collected
       FROM deals d
       WHERE (d.stage IN ('Won','won','completed','closed') OR d.status IN ('WON','COMPLETED','CLOSED'))
         AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.deal_id = d.id)
       ORDER BY d.created_at ASC`
    );

    if (dryRun) {
      return NextResponse.json({
        success: true,
        would_create: candidates.rows.length,
        deals: candidates.rows,
      });
    }

    // Get next invoice number per year via invoice_sequences.
    const year = new Date().getFullYear();
    let created = 0;
    const errors = [];

    for (const d of candidates.rows) {
      try {
        const seq = await query(
          `INSERT INTO invoice_sequences (year, last_number)
           VALUES ($1, 1)
           ON CONFLICT (year) DO UPDATE SET last_number = invoice_sequences.last_number + 1
           RETURNING last_number`,
          [year]
        );
        const invoiceNumber = `XH-INV-${year}-${String(seq.rows[0].last_number).padStart(4, '0')}`;
        const token = crypto.randomBytes(12).toString('hex');
        const amount    = parseFloat(d.value_estimate || 0);
        const collected = parseFloat(d.collected || 0);
        const remaining = Math.max(0, amount - collected);
        const status = remaining === 0 && amount > 0 ? 'paid'
                     : collected > 0                  ? 'partially_paid'
                     : 'pending';

        await query(
          `INSERT INTO invoices (
             invoice_number, verification_token, deal_id, client_id, client_name,
             deal_title, deal_total_amount, amount, currency,
             total_paid_before, total_paid_after, remaining_balance,
             issued_by_user_id, issued_date, status, source,
             system_id, notes
           ) VALUES (
             $1,$2,$3,$4,$5,
             $6,$7,$7,$8,
             0,$9,$10,
             $11,COALESCE($12::date, CURRENT_DATE),$13,'auto_reconciled',
             $14,'Auto-generated on reconciliation run — verify totals before sending to client.'
           )`,
          [
            invoiceNumber, token, d.id, d.client_id, d.client_name || 'Unknown client',
            d.title, amount, d.currency || 'UGX',
            collected, remaining,
            auth.userId, d.expected_close_date, status,
            d.system_id,
          ]
        );
        created++;
      } catch (err) {
        errors.push({ deal_id: d.id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      candidates: candidates.rows.length,
      created,
      errors,
    });
  } catch (error) {
    console.error('[invoices/reconcile] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
