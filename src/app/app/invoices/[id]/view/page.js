'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InvoiceTemplate from '@/components/invoice/InvoiceTemplate';
import './ViewInvoice.css';

export default function ViewInvoicePage({ params }) {
  const { id } = params;
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();

      if (data.success) {
        setInvoice(data.data);
        setItems(data.data.items || []);
      } else {
        setError(data.error || 'Failed to load invoice');
      }
    } catch (err) {
      setError('Error loading invoice');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.location.href = `/invoices/${id}/pdf`;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/invoices');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  if (loading) {
    return (
      <div className="view-container">
        <div className="loading">Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="view-container">
        <div className="error-state">
          <p>{error || 'Invoice not found'}</p>
          <Link href="/invoices">
            <button className="btn-back">← Back to Invoices</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <Link href="/invoices">
          <button className="btn-back">← Back to Invoices</button>
        </Link>

        <div className="view-actions">
          <button className="btn-action btn-print" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="btn-action btn-download" onClick={handleDownloadPDF}>
            📥 Download PDF
          </button>
          <Link href={`/invoices/${id}/edit`}>
            <button className="btn-action btn-edit">✏️ Edit</button>
          </Link>
          <button className="btn-action btn-delete" onClick={handleDelete}>
            🗑️ Delete
          </button>
        </div>
      </div>

      <InvoiceTemplate invoice={invoice} items={items} />
    </div>
  );
}
