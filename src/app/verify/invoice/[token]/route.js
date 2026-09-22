import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { getCompanySettings } from '@/lib/company-settings.js';
import { renderInvoiceHtml, loadActiveTheme } from '@/lib/invoice-render.js';

/**
 * GET /verify/invoice/[token]
 *
 * Public, unauthenticated. What a QR scanner hits. Renders the same
 * invoice document that the customer downloaded, framed with a
 * "verified" banner. Two lookup paths:
 *
 *   1. token   — 24-hex from verification_token (preferred, non-enumerable)
 *   2. number  — invoice_number (fallback for legacy links)
 *
 * Increments verification_count + last_verified_at + writes a
 * 'verified' event row. Voided invoices render with a VOIDED banner
 * so the scanner sees the truth. Unknown tokens render a proper
 * "not found" page — no leak.
 */
export async function GET(request, { params }) {
  const { token } = await params;

  try {
    const invRes = await query(
      `SELECT i.*, COALESCE(
               (SELECT json_agg(json_build_object(
                 'description', ii.description,
                 'quantity',    ii.quantity,
                 'unit_price',  ii.unit_price,
                 'total_price', ii.total_price
               ) ORDER BY ii.created_at ASC)
                FROM invoice_items ii WHERE ii.invoice_id = i.id), '[]'::json
             ) AS items
       FROM invoices i
       WHERE i.verification_token = $1 OR i.invoice_number = $1
       LIMIT 1`,
      [token]
    );

    if (invRes.rows.length === 0) {
      return new NextResponse(notFoundPage(token), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const invoice = invRes.rows[0];
    const [company, theme] = await Promise.all([
      getCompanySettings(),
      loadActiveTheme(invoice.theme_id),
    ]);

    // Audit + counter. Non-blocking.
    query(
      `UPDATE invoices
       SET verification_count = COALESCE(verification_count, 0) + 1,
           last_verified_at   = NOW()
       WHERE id = $1`,
      [invoice.id]
    ).catch(() => {});
    query(
      `INSERT INTO invoice_events (invoice_id, action, ip_address, user_agent)
       VALUES ($1, 'verified', $2, $3)`,
      [invoice.id,
       request.headers.get('x-forwarded-for') || null,
       request.headers.get('user-agent') || null]
    ).catch(() => {});

    const origin = new URL(request.url).origin;
    const verifyUrl = `${origin}/verify/invoice/${invoice.verification_token || invoice.invoice_number}`;

    const html = renderInvoiceHtml({
      invoice, company, theme, items: invoice.items || [],
      verifyUrl, mode: 'verify',
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[verify/invoice] error:', error);
    return new NextResponse(errorPage(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

/**
 * Standalone HTML for the "not found" case. We don't share the render
 * engine here because there's no invoice to render — this needs its
 * own minimal chrome that still looks like Jeton.
 */
function notFoundPage(token) {
  const safe = String(token).replace(/[<>&"']/g, '');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice not found</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; background:#f5f5f5; margin:0; padding:80px 20px; color:#222; }
    .card { max-width: 480px; margin: 0 auto; background:#fff; border:1px solid #dcdcdc; border-radius:8px; padding:40px; text-align:center; }
    .icon { width:64px; height:64px; margin:0 auto 20px; border-radius:50%; background:#fee2e2; display:flex; align-items:center; justify-content:center; font-size:32px; color:#991b1b; }
    h1 { margin:0 0 8px; color:#991b1b; font-size:24px; }
    p { color:#666; font-size:14px; line-height:1.6; }
    code { background:#f5f5f5; padding:2px 6px; border-radius:3px; font-size:12px; color:#444; }
  </style></head><body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>Invoice not found</h1>
    <p>No invoice matches the identifier <code>${safe}</code>.</p>
    <p>The invoice may have been revoked, or the QR code you scanned may be from a copy that isn't genuine.</p>
  </div></body></html>`;
}

function errorPage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Verification error</title>
  <style>body{font-family:'Segoe UI',sans-serif;padding:80px 20px;text-align:center;color:#222;background:#f5f5f5}</style>
  </head><body><h1>Verification service temporarily unavailable</h1>
  <p>Please try again in a moment.</p></body></html>`;
}
