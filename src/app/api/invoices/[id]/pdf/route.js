import { NextResponse } from 'next/server';
import { getInvoiceById, getInvoiceItems } from '@/lib/db-invoices';

// NOTE: PDF generation requires puppeteer which is not compatible with serverless/edge
// For production, consider using a dedicated PDF service or client-side generation
// This route returns HTML that can be printed to PDF by the browser

// Helper to generate HTML invoice
function generateInvoiceHTML(invoice, items) {
  const formatCurrency = (value, currency = 'UGX') => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#777',
      sent: '#4a90e2',
      paid: '#2ecc71',
      partially_paid: '#f39c12',
      overdue: '#e74c3c',
      cancelled: '#95a5a6',
    };
    return colors[status] || '#777';
  };

  const paymentMethods = invoice.payment_methods
    ? JSON.parse(invoice.payment_methods)
    : ['Bank Transfer', 'Mobile Money (MTN, Airtel)', 'Cash'];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    :root {
      --primary: #0f3c2e;
      --secondary: #e6f2ee;
      --text-dark: #222;
      --border: #dcdcdc;
    }

    * {
      box-sizing: border-box;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    }

    body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    .invoice-wrapper {
      max-width: 900px;
      margin: 40px auto;
      background: #fff;
      padding: 40px;
      border: 1px solid var(--border);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid var(--primary);
      padding-bottom: 20px;
      margin-bottom: 30px;
      gap: 20px;
    }

    .logo-placeholder {
      flex-shrink: 0;
      width: 80px;
      height: 80px;
      background: var(--secondary);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
      color: var(--primary);
    }

    .company-info {
      flex: 1;
    }

    .company-info h1 {
      margin: 0;
      font-size: 28px;
      color: var(--primary);
      font-weight: 600;
    }

    .company-info p {
      margin: 4px 0;
      font-size: 14px;
      color: #444;
    }

    .invoice-meta {
      text-align: right;
    }

    .invoice-meta h2 {
      margin: 0;
      color: var(--primary);
      font-size: 26px;
      font-weight: 600;
    }

    .invoice-meta p {
      margin: 4px 0;
      font-size: 14px;
    }

    .billing {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }

    .billing div {
      width: 48%;
    }

    .billing h3 {
      margin-bottom: 8px;
      color: var(--primary);
      font-size: 16px;
      font-weight: 600;
    }

    .billing p {
      margin: 3px 0;
      font-size: 14px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    table thead {
      background: var(--secondary);
    }

    table th,
    table td {
      padding: 12px;
      border: 1px solid var(--border);
      font-size: 14px;
      text-align: left;
    }

    table th {
      color: var(--primary);
      font-weight: 600;
    }

    table td.amount,
    table th.amount {
      text-align: right;
    }

    .totals {
      width: 100%;
      max-width: 400px;
      margin-left: auto;
      margin-bottom: 30px;
    }

    .totals table {
      border: none;
      margin-bottom: 0;
    }

    .totals td {
      border: none;
      padding: 6px 0;
      font-size: 14px;
    }

    .totals .label {
      text-align: left;
      padding-right: 20px;
    }

    .totals .value {
      text-align: right;
    }

    .totals .balance {
      font-weight: bold;
      font-size: 16px;
      color: var(--primary);
      border-top: 1px solid var(--border);
      padding-top: 8px !important;
    }

    .notes {
      margin: 30px 0;
      font-size: 14px;
      color: #444;
      line-height: 1.6;
    }

    .signature {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .signature .sign-box {
      width: 300px;
    }

    .signature .line {
      border-top: 1px solid #000;
      margin-bottom: 6px;
      height: 0;
    }

    .signature p {
      margin: 2px 0;
      font-size: 14px;
    }

    .status {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 18px;
      letter-spacing: 1px;
    }

    .invoice-footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid var(--border);
      display: flex;
      justify-content: space-between;
      gap: 40px;
    }

    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .qr-section h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--primary);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .qr-placeholder {
      width: 120px;
      height: 120px;
      border: 2px solid var(--primary);
      padding: 8px;
      background: #fff;
      border-radius: 4px;
      display: inline-block;
      color: #999;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qr-section p {
      margin: 8px 0 0 0;
      font-size: 12px;
      color: #666;
      max-width: 180px;
    }

    .payment-section {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .payment-section h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--primary);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .payment-methods {
      background: var(--secondary);
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .payment-methods h5 {
      margin: 0 0 10px 0;
      font-size: 12px;
      color: var(--primary);
      font-weight: 600;
    }

    .payment-methods ul {
      margin: 0;
      padding-left: 20px;
      list-style: none;
    }

    .payment-methods li {
      margin: 6px 0;
      font-size: 13px;
      color: var(--text-dark);
      position: relative;
      padding-left: 16px;
    }

    .payment-methods li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: var(--primary);
      font-weight: bold;
    }

    .payment-method-used {
      background: #fafafa;
      padding: 12px;
      border-left: 3px solid var(--primary);
      border-radius: 2px;
    }

    .payment-method-used p {
      margin: 0;
      font-size: 12px;
      color: #666;
    }

    .payment-method-used .method-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary);
      margin: 4px 0 0 0;
    }

    @page {
      size: A4;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="header">
      <div class="logo-placeholder">${invoice.company_name?.substring(0, 1) || 'X'}</div>
      <div class="company-info">
        <h1>${invoice.company_name || 'Xhenvolt Uganda SMC Limited'}</h1>
        <p>${invoice.company_address || 'Bulubandi, Iganga, Uganda'}</p>
        <p>${invoice.company_service_type || 'Software Development & Digital Solutions'}</p>
      </div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
        <p><strong>Date:</strong> ${formatDate(invoice.issue_date)}</p>
      </div>
    </div>

    <div class="billing">
      <div>
        <h3>Billed To</h3>
        <p><strong>${invoice.client_name}</strong></p>
        ${invoice.client_address ? `<p>${invoice.client_address}</p>` : ''}
        ${invoice.client_email ? `<p>${invoice.client_email}</p>` : ''}
        ${invoice.client_phone ? `<p>${invoice.client_phone}</p>` : ''}
      </div>
      <div>
        <h3>Issued By</h3>
        <p><strong>${invoice.company_name || 'Xhenvolt Uganda SMC Limited'}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Qty</th>
          <th class="amount">Unit Price (${invoice.currency || 'UGX'})</th>
          <th class="amount">Amount (${invoice.currency || 'UGX'})</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="amount">${formatCurrency(item.quantity)}</td>
          <td class="amount">${formatCurrency(item.unit_price)}</td>
          <td class="amount">${formatCurrency(item.total_price)}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">${formatCurrency(invoice.subtotal)} ${invoice.currency || 'UGX'}</td>
        </tr>
        ${
          invoice.tax > 0
            ? `
        <tr>
          <td class="label">Tax</td>
          <td class="value">${formatCurrency(invoice.tax)} ${invoice.currency || 'UGX'}</td>
        </tr>
        `
            : ''
        }
        ${
          invoice.discount > 0
            ? `
        <tr>
          <td class="label">Discount</td>
          <td class="value">-${formatCurrency(invoice.discount)} ${invoice.currency || 'UGX'}</td>
        </tr>
        `
            : ''
        }
        <tr>
          <td class="label">Total</td>
          <td class="value">${formatCurrency(invoice.total)} ${invoice.currency || 'UGX'}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid</td>
          <td class="value">${formatCurrency(invoice.amount_paid)} ${invoice.currency || 'UGX'}</td>
        </tr>
        <tr>
          <td class="label balance">Balance Due</td>
          <td class="value balance">${formatCurrency(invoice.balance_due)} ${invoice.currency || 'UGX'}</td>
        </tr>
      </table>
    </div>

    ${
      invoice.notes
        ? `
    <div class="notes">
      <p>${invoice.notes}</p>
    </div>
    `
        : ''
    }

    <div class="signature">
      <div class="sign-box">
        <div class="line"></div>
        <p><strong>${invoice.signed_by || 'HAMUZA IBRAHIM'}</strong></p>
        <p>${invoice.signed_by_title || 'Chief Executive Officer (CEO)'}</p>
        <p>${invoice.company_name || 'Xhenvolt Uganda SMC Limited'}</p>
      </div>
      <div class="status" style="color: ${getStatusColor(invoice.status)}">
        ${invoice.status
          .replace(/_/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')}
      </div>
    </div>

    <div class="invoice-footer">
      <div class="qr-section">
        <h4>Invoice Authenticity Verification</h4>
        <div class="qr-placeholder">
          [QR Code would appear here]
        </div>
        <p>Scan to verify invoice authenticity</p>
      </div>

      <div class="payment-section">
        <h4>Payment Information</h4>
        <div class="payment-methods">
          <h5>Accepted Payment Methods</h5>
          <ul>
            ${paymentMethods.map((method) => `<li>${method}</li>`).join('')}
          </ul>
        </div>
        ${
          invoice.payment_method_used
            ? `
        <div class="payment-method-used">
          <p>Payment Method Used</p>
          <div class="method-name">${invoice.payment_method_used}</div>
        </div>
        `
            : ''
        }
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Fetch invoice and items
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const items = await getInvoiceItems(id);

    // Generate HTML
    const html = generateInvoiceHTML(invoice, items);

    // NOTE: PDF generation requires puppeteer or another PDF library
    // For now, we'll return the HTML that can be rendered in a browser and printed to PDF
    // To enable true PDF generation, install: npm install puppeteer
    // Then uncomment the PDF generation code below

    // UNCOMMENT THIS SECTION TO ENABLE PDF GENERATION WITH PUPPETEER:
    /*
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          right: '0px',
          bottom: '0px',
          left: '0px',
        },
      });
      await browser.close();

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
        },
      });
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Fall back to HTML if PDF fails
    }
    */

    // For now, return HTML that can be printed to PDF
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF', message: error.message },
      { status: 500 }
    );
  }
}
