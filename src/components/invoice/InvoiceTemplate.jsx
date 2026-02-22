'use client';

import React, { useEffect, useRef } from 'react';
import './InvoiceTemplate.css';

export default function InvoiceTemplate({ invoice, items = [], isPrint = false }) {
  const qrRef = useRef(null);

  useEffect(() => {
    // Generate QR code if QR library is available
    if (qrRef.current && typeof window !== 'undefined' && window.QRCode) {
      qrRef.current.innerHTML = ''; // Clear previous QR code
      try {
        const verificationUrl = `${window.location.origin}/invoices/${invoice.invoice_number}/verify`;
        new window.QRCode(qrRef.current, {
          text: verificationUrl,
          width: 120,
          height: 120,
          colorDark: '#0f3c2e',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.H,
        });
      } catch (e) {
        console.error('QR Code generation error:', e);
        if (qrRef.current) {
          qrRef.current.innerHTML =
            '<p style="color: red; font-size: 12px;">QR Code failed to generate</p>';
        }
      }
    }
  }, [invoice.invoice_number]);

  const formatCurrency = (value, currency = 'UGX') => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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

  return (
    <div className={`invoice-wrapper ${isPrint ? 'print-mode' : ''}`}>
      {/* HEADER */}
      <div className="header">
        <div className="logo">
          {invoice.company_logo ? (
            <img src={invoice.company_logo} alt="Company Logo" />
          ) : (
            <div className="logo-placeholder">{invoice.company_name?.substring(0, 1)}</div>
          )}
        </div>

        <div className="company-info">
          <h1>{invoice.company_name || 'Xhenvolt Uganda SMC Limited'}</h1>
          <p>{invoice.company_address || 'Bulubandi, Iganga, Uganda'}</p>
          <p>{invoice.company_service_type || 'Software Development & Digital Solutions'}</p>
        </div>

        <div className="invoice-meta">
          <h2>INVOICE</h2>
          <p>
            <strong>Invoice No:</strong> {invoice.invoice_number}
          </p>
          <p>
            <strong>Date:</strong> {formatDate(invoice.issue_date)}
          </p>
        </div>
      </div>

      {/* BILLING */}
      <div className="billing">
        <div>
          <h3>Billed To</h3>
          <p>
            <strong>{invoice.client_name}</strong>
          </p>
          {invoice.client_address && <p>{invoice.client_address}</p>}
          {invoice.client_email && <p>{invoice.client_email}</p>}
          {invoice.client_phone && <p>{invoice.client_phone}</p>}
        </div>

        <div>
          <h3>Issued By</h3>
          <p>
            <strong>{invoice.company_name || 'Xhenvolt Uganda SMC Limited'}</strong>
          </p>
        </div>
      </div>

      {/* TABLE */}
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="amount">Amount ({invoice.currency || 'UGX'})</th>
          </tr>
        </thead>
        <tbody>
          {items && items.length > 0 ? (
            <>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td className="amount">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', backgroundColor: 'transparent' }}>
                <th>Total Amount</th>
                <th className="amount">{formatCurrency(invoice.subtotal)}</th>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan="2">No items</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="totals">
        <table>
          <tbody>
            <tr>
              <td className="label">Amount Paid</td>
              <td className="value">
                {formatCurrency(invoice.amount_paid)}
              </td>
            </tr>
            <tr>
              <td className="label balance">Balance Due</td>
              <td className="value balance">
                {formatCurrency(invoice.balance_due)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* NOTES */}
      {invoice.notes && (
        <div className="notes">
          <p>{invoice.notes}</p>
        </div>
      )}

      {/* SIGNATURE */}
      <div className="signature">
        <div className="sign-box">
          <div className="line"></div>
          <p>
            <strong>{invoice.signed_by || 'HAMUZA IBRAHIM'}</strong>
          </p>
          <p>{invoice.signed_by_title || 'Chief Executive Officer (CEO)'}</p>
          <p>{invoice.company_name || 'Xhenvolt Uganda SMC Limited'}</p>
        </div>

        <div className="status" style={{ color: getStatusColor(invoice.status) }}>
          {invoice.status
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')}
        </div>
      </div>

      {/* INVOICE FOOTER: QR CODE & PAYMENT INFORMATION */}
      <div className="invoice-footer">
        {/* QR CODE SECTION */}
        <div className="qr-section">
          <h4>Invoice Authenticity Verification</h4>
          <div ref={qrRef} id="qrCode"></div>
          <p>Scan to verify invoice authenticity</p>
        </div>

        {/* PAYMENT INFORMATION SECTION */}
        <div className="payment-section">
          <h4>Payment Information</h4>

          <div className="payment-methods">
            <h5>Accepted Payment Methods</h5>
            <ul>
              {paymentMethods.map((method, index) => (
                <li key={index}>{method}</li>
              ))}
            </ul>
          </div>

          {invoice.payment_method_used && (
            <div className="payment-method-used">
              <p>Payment Method Used</p>
              <div className="method-name">{invoice.payment_method_used}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
