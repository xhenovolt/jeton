import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { dispatch } from '@/lib/system-events.js';
import { requirePermission } from '@/lib/permissions.js';
import { getCompanySettings } from '@/lib/company-settings.js';
import { renderInvoiceHtml, loadActiveTheme } from '@/lib/invoice-render.js';

/**
 * GET /api/invoices/[id]/pdf
 *
 * Renders the invoice as print-ready HTML using the shared render
 * engine (src/lib/invoice-render.js). The browser's own "Save as PDF"
 * from the toolbar keeps the text selectable, embeds fonts, and
 * preserves the A4 layout — no server-side PDF binary is generated.
 *
 * Side effects:
 *   - increments download_count and updates last_downloaded_at
 *   - writes an 'downloaded' event row to invoice_events
 *   - dispatches a system-events signal so activity feeds pick it up
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { id } = await params;

    const [invRes, company] = await Promise.all([
      query(
        `SELECT i.*, COALESCE(
                 (SELECT json_agg(json_build_object(
                   'description', ii.description,
                   'quantity',    ii.quantity,
                   'unit_price',  ii.unit_price,
                   'total_price', ii.total_price
                 ) ORDER BY ii.created_at ASC)
                  FROM invoice_items ii WHERE ii.invoice_id = i.id), '[]'::json
               ) AS items
         FROM invoices i WHERE i.id = $1`,
        [id]
      ),
      getCompanySettings(),
    ]);
    if (!invRes.rows[0]) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }
    const invoice = invRes.rows[0];
    const items   = invoice.items || [];

    const theme = await loadActiveTheme(invoice.theme_id);

    // Build the public verification URL. Prefer token — safer than
    // enumerable invoice_number — but fall back for legacy rows.
    const origin = new URL(request.url).origin;
    const verifyUrl = invoice.verification_token
      ? `${origin}/verify/invoice/${invoice.verification_token}`
      : `${origin}/verify/invoice/${encodeURIComponent(invoice.invoice_number)}`;

    // Update counters + event log. Non-blocking — the invoice returns
    // even if the audit write hiccups (which would otherwise turn a
    // download failure into a 500 for the customer-facing user).
    query(
      `UPDATE invoices
       SET download_count = COALESCE(download_count, 0) + 1,
           last_downloaded_at = NOW()
       WHERE id = $1`,
      [id]
    ).catch(() => {});
    query(
      `INSERT INTO invoice_events (invoice_id, actor_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'downloaded', $3, $4)`,
      [id, auth.userId,
       request.headers.get('x-forwarded-for') || null,
       request.headers.get('user-agent') || null]
    ).catch(() => {});
    dispatch('invoice_downloaded', {
      entityType: 'invoice', entityId: id,
      description: `Invoice ${invoice.invoice_number} downloaded`,
      metadata: { invoice_number: invoice.invoice_number },
      actorId: auth.userId,
    }).catch(() => {});

    const html = renderInvoiceHtml({
      invoice, company, theme, items, verifyUrl, mode: 'download',
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Invoices] PDF error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate invoice' }, { status: 500 });
  }
}
