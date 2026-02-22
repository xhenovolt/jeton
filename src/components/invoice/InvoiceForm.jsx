'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { calculateTotals, formatCurrency } from '@/lib/invoice-validation';
import './InvoiceForm.css';

const PAYMENT_METHODS = ['Bank Transfer', 'Mobile Money (MTN, Airtel)', 'Cash', 'Check', 'Online Payment'];
const CURRENCIES = ['UGX', 'USD', 'EUR', 'GBP', 'KES'];

export default function InvoiceForm({ initialData = null, onSubmitSuccess = null, isLoading = false }) {
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    invoiceName: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    currency: 'UGX',
    signedBy: 'HAMUZA IBRAHIM',
    signedByTitle: 'Chief Executive Officer (CEO)',
    paymentMethods: PAYMENT_METHODS,
    paymentMethodUsed: '',
  });

  const [items, setItems] = useState([
    {
      id: Date.now(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    },
  ]);

  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [status, setStatus] = useState('draft');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }));
      if (initialData.items) {
        setItems(initialData.items);
      }
      if (initialData.status) {
        setStatus(initialData.status);
      }
    }
  }, [initialData]);

  // Get next invoice number on mount
  useEffect(() => {
    if (!initialData && !formData.invoiceNumber) {
      fetchNextInvoiceNumber();
    }
  }, []);

  const fetchNextInvoiceNumber = async () => {
    try {
      const response = await fetch('/api/invoices/next-number');
      const data = await response.json();
      if (data.success) {
        setFormData((prev) => ({
          ...prev,
          invoiceNumber: data.data.nextInvoiceNumber,
        }));
      }
    } catch (error) {
      console.error('Error fetching invoice number:', error);
    }
  };

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  }, [errors]);

  const handleItemChange = useCallback(
    (id, field, value) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const updatedItem = {
              ...item,
              [field]: field === 'description' ? value : parseFloat(value) || 0,
            };

            // Auto-calculate total price
            if (field === 'quantity' || field === 'unitPrice') {
              updatedItem.totalPrice = updateItemTotal(updatedItem);
            }

            return updatedItem;
          }
          return item;
        })
      );
    },
    []
  );

  const updateItemTotal = (item) => {
    const total = item.quantity * item.unitPrice;
    return Math.round(total * 100) / 100;
  };

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const calculateTotalsData = useCallback(() => {
    const validItems = items.filter((item) => item.description && item.totalPrice > 0);
    return calculateTotals(validItems, taxRate, discountAmount);
  }, [items, taxRate, discountAmount]);

  const totals = calculateTotalsData();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.invoiceNumber.trim()) {
      newErrors.invoiceNumber = 'Invoice number is required';
    }
    if (!formData.invoiceName.trim()) {
      newErrors.invoiceName = 'Invoice name is required';
    }
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }
    if (!formData.issueDate) {
      newErrors.issueDate = 'Issue date is required';
    }
    if (items.length === 0) {
      newErrors.items = 'At least one item is required';
    } else {
      const validItems = items.filter((item) => item.description && item.totalPrice > 0);
      if (validItems.length === 0) {
        newErrors.items = 'Please ensure items have description and amount';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, submitStatus = 'draft') => {
    e.preventDefault();

    if (!validateForm()) {
      setErrorMessage('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccess(false);

    try {
      const validItems = items.filter((item) => item.description && item.totalPrice > 0);
      const totals = calculateTotals(validItems, taxRate, discountAmount);

      const payload = {
        ...formData,
        amountPaid: 0,
        balanceDue: totals.total,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        status: submitStatus,
        items: validItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      };

      const url = initialData ? `/api/invoices/${initialData.id}` : '/api/invoices';
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to save invoice');
        setErrors(data.errors || {});
        return;
      }

      setSuccess(true);
      setFormData({
        invoiceNumber: '',
        invoiceName: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        notes: '',
        currency: 'UGX',
        signedBy: 'HAMUZA IBRAHIM',
        signedByTitle: 'Chief Executive Officer (CEO)',
        paymentMethods: PAYMENT_METHODS,
        paymentMethodUsed: '',
      });
      setItems([
        {
          id: Date.now(),
          description: '',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
        },
      ]);

      if (onSubmitSuccess) {
        onSubmitSuccess(data.data);
      }

      // Fetch next invoice number for new invoice
      if (!initialData) {
        fetchNextInvoiceNumber();
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      setErrorMessage('An error occurred while saving the invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, status)} className="invoice-form">
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {success && <div className="success-message">Invoice saved successfully!</div>}

      <div className="form-section">
        <h2>Invoice Details</h2>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="invoiceNumber">Invoice Number *</label>
            <input
              type="text"
              id="invoiceNumber"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleFormChange}
              placeholder="XH/INV/2601/001"
              readOnly
              className={errors.invoiceNumber ? 'error' : ''}
            />
            {errors.invoiceNumber && <span className="error-text">{errors.invoiceNumber}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="invoiceName">Invoice Name/Title *</label>
            <input
              type="text"
              id="invoiceName"
              name="invoiceName"
              value={formData.invoiceName}
              onChange={handleFormChange}
              placeholder="Project Name or Service Description"
              className={errors.invoiceName ? 'error' : ''}
            />
            {errors.invoiceName && <span className="error-text">{errors.invoiceName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="issueDate">Issue Date *</label>
            <input
              type="date"
              id="issueDate"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleFormChange}
              className={errors.issueDate ? 'error' : ''}
            />
            {errors.issueDate && <span className="error-text">{errors.issueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="dueDate">Due Date</label>
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleFormChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleFormChange}
            >
              {CURRENCIES.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Client Information</h2>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="clientName">Client Name *</label>
            <input
              type="text"
              id="clientName"
              name="clientName"
              value={formData.clientName}
              onChange={handleFormChange}
              placeholder="Client or Company Name"
              className={errors.clientName ? 'error' : ''}
            />
            {errors.clientName && <span className="error-text">{errors.clientName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="clientEmail">Email</label>
            <input
              type="email"
              id="clientEmail"
              name="clientEmail"
              value={formData.clientEmail}
              onChange={handleFormChange}
              placeholder="client@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="clientPhone">Phone</label>
            <input
              type="tel"
              id="clientPhone"
              name="clientPhone"
              value={formData.clientPhone}
              onChange={handleFormChange}
              placeholder="+256..."
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="clientAddress">Address</label>
            <textarea
              id="clientAddress"
              name="clientAddress"
              value={formData.clientAddress}
              onChange={handleFormChange}
              placeholder="Client address"
              rows="3"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Invoice Items</h2>

        {errors.items && <div className="error-text form-error">{errors.items}</div>}

        <div className="items-table">
          <div className="items-header">
            <div className="col-description">Description</div>
            <div className="col-quantity">Qty</div>
            <div className="col-unit-price">Unit Price ({formData.currency})</div>
            <div className="col-total">Total ({formData.currency})</div>
            <div className="col-action">Action</div>
          </div>

          {items.map((item) => (
            <div key={item.id} className="items-row">
              <div className="col-description">
                <input
                  type="text"
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  className="item-input"
                />
              </div>
              <div className="col-quantity">
                <input
                  type="number"
                  placeholder="1"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  className="item-input"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="col-unit-price">
                <input
                  type="number"
                  placeholder="0"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                  className="item-input"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="col-total">
                <span className="item-total">{formatCurrency(item.totalPrice)}</span>
              </div>
              <div className="col-action">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="btn-remove"
                  disabled={items.length === 1}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addItem} className="btn-add-item">
          + Add Item
        </button>
      </div>

      <div className="form-section">
        <h2>Calculations</h2>

        <div className="calc-grid">
          <div className="calc-group">
            <label htmlFor="taxRate">Tax Rate (%)</label>
            <input
              type="number"
              id="taxRate"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
              step="0.01"
            />
          </div>

          <div className="calc-group">
            <label htmlFor="discountAmount">Discount Amount ({formData.currency})</label>
            <input
              type="number"
              id="discountAmount"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="totals-summary">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)} {formData.currency}</span>
          </div>
          {totals.tax > 0 && (
            <div className="total-row">
              <span>Tax ({taxRate}%):</span>
              <span>{formatCurrency(totals.tax)} {formData.currency}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="total-row">
              <span>Discount:</span>
              <span>-{formatCurrency(totals.discount)} {formData.currency}</span>
            </div>
          )}
          <div className="total-row total">
            <span>Total:</span>
            <span>{formatCurrency(totals.total)} {formData.currency}</span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Additional Information</h2>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="signedBy">Signed By</label>
            <input
              type="text"
              id="signedBy"
              name="signedBy"
              value={formData.signedBy}
              onChange={handleFormChange}
              placeholder="Signatory Name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="signedByTitle">Signatory Title</label>
            <input
              type="text"
              id="signedByTitle"
              name="signedByTitle"
              value={formData.signedByTitle}
              onChange={handleFormChange}
              placeholder="Position/Title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="paymentMethodUsed">Payment Method Used</label>
            <select
              id="paymentMethodUsed"
              name="paymentMethodUsed"
              value={formData.paymentMethodUsed}
              onChange={handleFormChange}
            >
              <option value="">Select payment method</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="notes">Notes / Terms</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              placeholder="Additional notes, terms, or conditions"
              rows="4"
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          onClick={(e) => handleSubmit(e, 'draft')}
          disabled={loading || isLoading}
          className="btn-save-draft"
        >
          {loading ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          type="submit"
          onClick={(e) => handleSubmit(e, 'sent')}
          disabled={loading || isLoading}
          className="btn-send"
        >
          {loading ? 'Saving...' : 'Send Invoice'}
        </button>
      </div>
    </form>
  );
}
