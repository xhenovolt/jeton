import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getCompanySettings } from '@/lib/company-settings.js';
import { renderInvoiceHtml } from '@/lib/invoice-render.js';

/**
 * GET /api/invoices/themes/[id]/preview
 *
 * Renders a fake but realistic invoice using the requested theme so the
 * theme editor can iframe an accurate preview without needing a real
 * invoice in the DB. The sample data below is picked to exercise every
 * section a theme controls (multi-item table, tax line, notes, terms,
 * signature, QR footer, payment info).
 *
 * Any user with invoices.view can preview — this returns HTML but no
 * real financial data, so it's safe for the same audience as the theme
 * settings page.
 */
export async function GET(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.view');
    if (perm instanceof NextResponse) return perm;

    const { id } = await params;
    const [themeRow, company] = await Promise.all([
      query('SELECT * FROM invoice_themes WHERE id = $1', [id]),
      getCompanySettings(),
    ]);
    if (themeRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Theme not found' }, { status: 404 });
    }
    const theme = themeRow.rows[0];

    // Sample data exercising every section the render engine handles.
    const invoice = {
      invoice_number: 'PREVIEW-XH-0001',
      issued_date: new Date().toISOString().slice(0, 10),
      due_date:    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      client_name: 'Excel Islamic Nursery & Primary School',
      client_email: 'admin@excelislamic.ug',
      client_phone: '+256 700 000 000',
      client_address: 'Busembatia, Namutumba District',
      deal_title: 'DRAIS School Management System — Gold Plan',
      system_name: 'DRAIS',
      plan_name:   'Gold',
      currency:    'UGX',
      amount:            2950000,
      deal_total_amount: 2950000,
      subtotal:          2500000,
      tax_rate:          18,
      tax_amount:        450000,
      total_paid_before: 0,
      total_paid_after:  500000,
      remaining_balance: 2450000,
      status: 'partially_paid',
      payment_method: 'Mobile Money',
      notes: 'This invoice covers the implementation of the DRAIS School Management System and development of Excel School Online Presence, including digital platform integrations. Balance payable as per agreed milestones.',
      terms_and_conditions: 'Payment due within 14 days. Late payments accrue 2% interest per month. All disputes settled by mutual agreement first.',
      issued_by_name:  'HAMUZA IBRAHIM',
      issued_by_title: 'Chief Executive Officer (CEO)',
      revision_number: 1,
    };
    const items = [
      { description: 'DRAIS School Management System — Gold Plan (Setup & Configuration)', total_price: 2500000 },
      { description: 'Excel School Online Presence (Website & Digital Setup)',             total_price:  450000 },
    ];
    const verifyUrl = new URL(request.url).origin + '/verify/invoice/preview';

    const html = renderInvoiceHtml({
      invoice, company, theme, items, verifyUrl, mode: 'download',
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // Iframe embedding is the entire point of this route.
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    console.error('[themes/preview] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
