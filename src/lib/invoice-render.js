/**
 * Invoice HTML render engine.
 *
 * One source of truth for how a Jeton invoice looks. Used by:
 *   - /api/invoices/[id]/pdf  (authenticated download)
 *   - /verify/invoice/[token] (public verification page)
 *   - previews rendered inline in the app
 *
 * All visual choices come from either the invoice_themes row (colors,
 * fonts, layout, section toggles) or from company_settings (name,
 * address, logo, contact). Nothing hard-coded here — swap the theme
 * and the page changes without any code touch.
 *
 * The layout follows the reference in invoicegen.html:
 *   header (logo + company info + invoice meta)
 *   billing (Billed To / Issued By)
 *   items table
 *   totals block
 *   notes
 *   signature + status
 *   footer (QR code + payment info)
 */

import { query } from './db.js';

const DEFAULT_THEME = {
  primary_color:     '#0f3c2e',
  secondary_color:   '#e6f2ee',
  accent_color:      '#b8860b',
  background_color:  '#ffffff',
  text_color:        '#222222',
  muted_color:       '#666666',
  border_color:      '#dcdcdc',
  font_family:       'Segoe UI, Tahoma, Arial, sans-serif',
  base_font_size:    14,
  paper_size:        'A4',
  orientation:       'portrait',
  margins:           { top: 40, right: 40, bottom: 40, left: 40 },
  rounded_corners:   true,
  header_layout:     'logo-left-meta-right',
  footer_layout:     'qr-left-payment-right',
  logo_size_px:      80,
  qr_position:       'footer-left',
  watermark_text:    null,
  watermark_opacity: 0.08,
  show_seal: false, show_signature: true, show_bank_details: true,
  show_tax_section: true, show_payment_instructions: true,
  show_terms: true, show_notes: true, show_qr: true, show_watermark: false,
};

export async function loadActiveTheme(themeId = null) {
  try {
    const row = themeId
      ? await query('SELECT * FROM invoice_themes WHERE id = $1', [themeId])
      : await query('SELECT * FROM invoice_themes WHERE is_default = TRUE ORDER BY created_at ASC LIMIT 1');
    if (row.rows.length === 0) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...row.rows[0] };
  } catch {
    // Theme table may not exist yet (fresh install pre-migration 979);
    // fall back to defaults so invoices still render.
    return DEFAULT_THEME;
  }
}

/**
 * HTML-escape a string. Not a full sanitizer — we only render values
 * that we own (invoice + company + theme rows), never raw user paste,
 * but the escape is defense-in-depth against a bad client_name.
 */
function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(amount, currency = 'UGX') {
  const n = parseFloat(amount || 0);
  return `${esc(currency)} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * QR code URL. Server-side rendering into an <img>. External API so we
 * don't add an npm dep — swap for a local `qrcode` install later
 * without touching callers.
 */
function qrUrl(text, size = 160) {
  const enc = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=svg&data=${enc}&color=0f3c2e&bgcolor=ffffff&qzone=1`;
}

/**
 * Compose the full HTML document. `opts.mode` = 'download' | 'verify'
 * changes the toolbar and the outer chrome; the invoice body is
 * identical across both so what a scanner sees matches what a customer
 * downloaded byte-for-byte in layout terms.
 */
export function renderInvoiceHtml({ invoice, company, theme = DEFAULT_THEME, items = [], verifyUrl, mode = 'download' }) {
  const t = theme;
  const isVerify = mode === 'verify';

  // ─── item rows ────────────────────────────────────────────────────────
  // Fall back to the single deal-based synthetic row if no invoice_items.
  const rows = items.length > 0
    ? items.map(it => `
      <tr>
        <td>${esc(it.description)}</td>
        <td class="amount">${fmtMoney(it.total_price ?? it.unit_price, invoice.currency)}</td>
      </tr>`).join('')
    : `
      <tr>
        <td>
          ${esc(invoice.deal_title || 'Services rendered')}
          ${invoice.system_name ? `<br><small style="color:${t.muted_color}">System: ${esc(invoice.system_name)}</small>` : ''}
          ${invoice.plan_name   ? `<br><small style="color:${t.muted_color}">Plan: ${esc(invoice.plan_name)}</small>`   : ''}
        </td>
        <td class="amount">${fmtMoney(invoice.amount, invoice.currency)}</td>
      </tr>`;

  const total       = invoice.deal_total_amount || invoice.amount || 0;
  const paidBefore  = invoice.total_paid_before || 0;
  const paidAfter   = invoice.total_paid_after  || (parseFloat(paidBefore) + parseFloat(invoice.amount || 0));
  const remaining   = invoice.remaining_balance != null
                        ? invoice.remaining_balance
                        : Math.max(0, parseFloat(total) - parseFloat(paidAfter));

  const showTax = t.show_tax_section && parseFloat(invoice.tax_amount || 0) > 0;

  // ─── QR section ───────────────────────────────────────────────────────
  const qrBlock = t.show_qr && verifyUrl ? `
    <div class="qr-section">
      <h4>Invoice Authenticity Verification</h4>
      <img id="qrCode" src="${qrUrl(verifyUrl)}" alt="QR code" width="160" height="160" />
      <p>Scan to verify at ${esc(new URL(verifyUrl).host)}</p>
    </div>` : '';

  // ─── payment info section ─────────────────────────────────────────────
  const bankLines = [
    company.bank_name    ? `<li>Bank: ${esc(company.bank_name)}</li>` : '',
    company.bank_account ? `<li>Account: ${esc(company.bank_account)}</li>` : '',
    company.mobile_money ? `<li>Mobile Money: ${esc(company.mobile_money)}</li>` : '',
  ].filter(Boolean).join('');

  const paymentBlock = t.show_payment_instructions ? `
    <div class="payment-section">
      <h4>Payment Information</h4>
      <div class="payment-methods">
        <h5>Accepted Payment Methods</h5>
        <ul>
          ${bankLines || '<li>Bank Transfer</li><li>Mobile Money (MTN, Airtel)</li><li>Cash</li>'}
        </ul>
      </div>
      ${invoice.payment_method ? `
      <div class="payment-method-used">
        <p>Payment Method Used</p>
        <div class="method-name">${esc(String(invoice.payment_method).replace(/_/g, ' '))}</div>
      </div>` : ''}
    </div>` : '';

  // ─── signature block ──────────────────────────────────────────────────
  const signatureBlock = t.show_signature ? `
    <div class="signature">
      <div class="sign-box">
        ${invoice.signature_image_url ? `<img src="${esc(invoice.signature_image_url)}" alt="Signature" style="max-height:60px;max-width:220px;object-fit:contain;display:block;margin-bottom:6px" />` : ''}
        <div class="line"></div>
        <p><strong>${esc(invoice.issued_by_name || company.company_name)}</strong></p>
        <p>${esc(invoice.issued_by_title || 'Authorised Signatory')}</p>
        <p>${esc(company.company_name)}</p>
      </div>
      <div class="status status-${esc(invoice.status || 'draft')}">
        ${esc(String(invoice.status || 'draft').replace(/_/g, ' ').toUpperCase())}
      </div>
    </div>` : '';

  const notesBlock = t.show_notes && invoice.notes ? `
    <div class="notes">${esc(invoice.notes).replace(/\n/g, '<br>')}</div>` : '';

  const termsBlock = t.show_terms && invoice.terms_and_conditions ? `
    <div class="terms">
      <h4>Terms & Conditions</h4>
      <div>${esc(invoice.terms_and_conditions).replace(/\n/g, '<br>')}</div>
    </div>` : '';

  const watermarkBlock = t.show_watermark && t.watermark_text ? `
    <div class="watermark-bg">${esc(t.watermark_text)}</div>` : '';

  // ─── toolbar ──────────────────────────────────────────────────────────
  const toolbar = isVerify
    ? `<div class="toolbar verify">
         <div class="verified-badge">
           <span class="check">✓</span>
           <span>Invoice verified · ${esc(invoice.invoice_number)}</span>
         </div>
         <button class="btn-secondary" onclick="window.print()">🖨️ Print</button>
       </div>`
    : `<div class="toolbar">
         <button class="btn-primary" onclick="window.print()">🖨️ Print / Save PDF</button>
         <span class="status-indicator">Ready</span>
       </div>`;

  const voidBanner = invoice.voided_at ? `
    <div class="void-banner">
      <strong>VOIDED</strong> on ${fmtDate(invoice.voided_at)}
      ${invoice.void_reason ? ` — ${esc(invoice.void_reason)}` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${esc(invoice.invoice_number)}</title>
  <style>
    :root {
      --primary:   ${t.primary_color};
      --secondary: ${t.secondary_color};
      --accent:    ${t.accent_color};
      --bg:        ${t.background_color};
      --text:      ${t.text_color};
      --muted:     ${t.muted_color};
      --border:    ${t.border_color};
    }
    * { box-sizing: border-box; font-family: ${t.font_family}; }
    body { margin: 0; padding: 0; background: #f5f5f5; color: var(--text); font-size: ${t.base_font_size}px; }

    /* toolbar */
    .toolbar { position: fixed; top: 0; left: 0; right: 0; background: var(--primary); color: #fff; padding: 12px 20px; display: flex; gap: 12px; align-items: center; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .toolbar button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all .2s; }
    .toolbar .btn-primary   { background: #fff; color: var(--primary); }
    .toolbar .btn-secondary { background: transparent; color: #fff; border: 1px solid #fff; }
    .toolbar .btn-secondary:hover { background: rgba(255,255,255,.1); }
    .toolbar .status-indicator { margin-left: auto; font-size: 12px; padding: 6px 12px; background: rgba(255,255,255,.2); border-radius: 4px; }
    .toolbar.verify .verified-badge { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .toolbar.verify .check { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #16a34a; border-radius: 50%; font-size: 14px; }
    .toolbar.verify button { margin-left: auto; }
    body { padding-top: 60px; }

    /* wrapper */
    .invoice-wrapper {
      position: relative;
      max-width: 900px;
      margin: 40px auto;
      background: var(--bg);
      padding: ${t.margins?.top ?? 40}px ${t.margins?.right ?? 40}px ${t.margins?.bottom ?? 40}px ${t.margins?.left ?? 40}px;
      border: 1px solid var(--border);
      ${t.rounded_corners ? 'border-radius: 6px;' : ''}
    }

    .void-banner { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; }

    /* watermark */
    .watermark-bg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 96px; font-weight: 900; color: var(--primary); opacity: ${t.watermark_opacity ?? 0.08}; letter-spacing: 8px; text-transform: uppercase; transform: rotate(-25deg); }

    /* header */
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px; gap: 20px; }
    .logo { flex-shrink: 0; }
    .logo img { max-height: ${t.logo_size_px}px; max-width: ${Math.round(t.logo_size_px * 1.5)}px; object-fit: contain; }
    .company-info { flex: 1; }
    .company-info h1 { margin: 0; font-size: 28px; color: var(--primary); }
    .company-info p { margin: 4px 0; font-size: 14px; color: var(--muted); }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { margin: 0; color: var(--primary); font-size: 26px; letter-spacing: 1px; }
    .invoice-meta p { margin: 4px 0; font-size: 14px; }

    /* billing */
    .billing { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 20px; }
    .billing > div { flex: 1; }
    .billing h3 { margin-bottom: 8px; color: var(--primary); font-size: 16px; }
    .billing p { margin: 3px 0; font-size: 14px; }

    /* items table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table thead { background: var(--secondary); }
    table th, table td { padding: 12px; border: 1px solid var(--border); font-size: 14px; }
    table th { text-align: left; color: var(--primary); }
    table td.amount, table th.amount { text-align: right; }

    /* totals */
    .totals { width: 100%; max-width: 400px; margin-left: auto; }
    .totals table { border: none; }
    .totals td { border: none; padding: 6px 0; font-size: 14px; }
    .totals .label { text-align: left; }
    .totals .value { text-align: right; }
    .totals .balance { font-weight: bold; font-size: 16px; color: var(--primary); border-top: 2px solid var(--primary); padding-top: 8px; }

    /* notes, terms */
    .notes, .terms { margin-top: 24px; font-size: 14px; color: #444; }
    .terms h4 { margin: 0 0 8px 0; font-size: 13px; color: var(--primary); text-transform: uppercase; letter-spacing: .5px; }

    /* signature + status */
    .signature { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
    .signature .sign-box { width: 300px; }
    .signature .line { border-top: 1px solid #000; margin-bottom: 6px; }
    .signature p { margin: 2px 0; font-size: 14px; }
    .status { margin-top: 20px; font-weight: bold; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; }
    .status-paid           { color: #166534; background: #dcfce7; }
    .status-partially_paid { color: #92400e; background: #fef3c7; }
    .status-pending, .status-sent, .status-draft { color: #1e40af; background: #dbeafe; }
    .status-overdue        { color: #991b1b; background: #fee2e2; }
    .status-voided, .status-cancelled { color: #4b5563; background: #e5e7eb; }

    /* footer: QR + payment */
    .invoice-footer { margin-top: 50px; padding-top: 30px; border-top: 2px solid var(--border); display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: flex-start; ${t.qr_position === 'footer-right' ? 'direction: rtl;' : ''} }
    .invoice-footer > * { direction: ltr; }
    .qr-section { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .qr-section h4 { margin: 0 0 12px; font-size: 13px; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
    #qrCode { border: 2px solid var(--primary); padding: 8px; background: #fff; ${t.rounded_corners ? 'border-radius: 4px;' : ''} }
    .qr-section p { margin: 8px 0 0; font-size: 12px; color: var(--muted); max-width: 220px; }
    .payment-section h4 { margin: 0 0 12px; font-size: 13px; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
    .payment-methods { background: var(--secondary); padding: 12px; ${t.rounded_corners ? 'border-radius: 4px;' : ''} margin-bottom: 16px; }
    .payment-methods h5 { margin: 0 0 10px; font-size: 12px; color: var(--primary); font-weight: 600; }
    .payment-methods ul { margin: 0; padding-left: 20px; list-style: none; }
    .payment-methods li { margin: 6px 0; font-size: 13px; position: relative; padding-left: 16px; }
    .payment-methods li:before { content: "✓"; position: absolute; left: 0; color: var(--primary); font-weight: bold; }
    .payment-method-used { background: #fafafa; padding: 12px; border-left: 3px solid var(--primary); ${t.rounded_corners ? 'border-radius: 2px;' : ''} }
    .payment-method-used p { margin: 0; font-size: 12px; color: var(--muted); }
    .payment-method-used .method-name { font-size: 14px; font-weight: 600; color: var(--primary); margin: 4px 0 0; }

    /* generated timestamp */
    .generated-stamp { margin-top: 24px; text-align: center; font-size: 10px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }

    /* print */
    @media print {
      body { background: #fff; padding-top: 0; }
      .toolbar { display: none !important; }
      .invoice-wrapper { margin: 0; border: none; border-radius: 0; padding: 20mm 15mm; }
    }
    @page { size: ${t.paper_size || 'A4'} ${t.orientation || 'portrait'}; margin: 0; }
  </style>
</head>
<body>
  ${toolbar}
  <div class="invoice-wrapper">
    ${watermarkBlock}
    ${voidBanner}

    <div class="header">
      <div class="logo">
        ${company.company_logo ? `<img src="${esc(company.company_logo)}" alt="${esc(company.company_name)}" />` : ''}
      </div>
      <div class="company-info">
        <h1>${esc(company.company_name)}</h1>
        ${company.company_address ? `<p>${esc(company.company_address)}</p>` : ''}
        ${company.company_tagline ? `<p>${esc(company.company_tagline)}</p>` : ''}
        <p>${[company.company_phone_1, company.company_phone_2, company.company_email].filter(Boolean).map(esc).join(' · ')}</p>
        ${company.company_tin ? `<p>TIN: ${esc(company.company_tin)}</p>` : ''}
      </div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <p><strong>Invoice No:</strong> ${esc(invoice.invoice_number)}</p>
        <p><strong>Date:</strong> ${fmtDate(invoice.issued_date)}</p>
        ${invoice.due_date ? `<p><strong>Due:</strong> ${fmtDate(invoice.due_date)}</p>` : ''}
      </div>
    </div>

    <div class="billing">
      <div>
        <h3>Billed To</h3>
        <p><strong>${esc(invoice.client_name)}</strong></p>
        ${invoice.client_email   ? `<p>${esc(invoice.client_email)}</p>`   : ''}
        ${invoice.client_phone   ? `<p>${esc(invoice.client_phone)}</p>`   : ''}
        ${invoice.client_address ? `<p>${esc(invoice.client_address)}</p>` : ''}
      </div>
      <div>
        <h3>Issued By</h3>
        <p><strong>${esc(company.company_name)}</strong></p>
        ${invoice.deal_title  ? `<p>Deal: ${esc(invoice.deal_title)}</p>`  : ''}
        ${invoice.system_name ? `<p>System: ${esc(invoice.system_name)}</p>` : ''}
        ${invoice.plan_name   ? `<p>Plan: ${esc(invoice.plan_name)}</p>`   : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Amount (${esc(invoice.currency || 'UGX')})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td class="label">Subtotal</td><td class="value">${fmtMoney(invoice.subtotal ?? invoice.amount, invoice.currency)}</td></tr>
        ${parseFloat(invoice.discount_amount || 0) > 0 ? `<tr><td class="label">Discount</td><td class="value">-${fmtMoney(invoice.discount_amount, invoice.currency)}</td></tr>` : ''}
        ${showTax ? `<tr><td class="label">Tax (${invoice.tax_rate || 0}%)</td><td class="value">${fmtMoney(invoice.tax_amount, invoice.currency)}</td></tr>` : ''}
        <tr><td class="label">Total</td><td class="value"><strong>${fmtMoney(total, invoice.currency)}</strong></td></tr>
        <tr><td class="label">Amount Paid</td><td class="value">${fmtMoney(paidAfter, invoice.currency)}</td></tr>
        <tr><td class="label balance">Balance Due</td><td class="value balance">${fmtMoney(remaining, invoice.currency)}</td></tr>
      </table>
    </div>

    ${invoice.fx_original_currency && invoice.fx_original_currency !== invoice.currency ? `
    <div class="notes" style="margin-top:16px;padding:10px;background:var(--secondary);border-left:3px solid var(--primary);">
      <strong>Original transaction:</strong> ${fmtMoney(invoice.fx_original_amount, invoice.fx_original_currency)}
      at rate ${invoice.fx_rate} on ${fmtDate(invoice.fx_rate_date)}.
    </div>` : ''}

    ${notesBlock}
    ${termsBlock}
    ${signatureBlock}

    <div class="invoice-footer">
      ${qrBlock}
      ${paymentBlock}
    </div>

    <div class="generated-stamp">
      Generated by Jeton OS · ${fmtDate(new Date())} · Revision ${invoice.revision_number || 1}
    </div>
  </div>
</body>
</html>`;
}

export default { renderInvoiceHtml, loadActiveTheme };
