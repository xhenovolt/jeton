'use client';

import React, { useState, useEffect } from 'react';
import InvoiceTemplate from '@/components/invoice/InvoiceTemplate';

export default function PrintInvoicePage({ params }) {
  const { id } = params;
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

  if (loading) {
    return <div style={{ padding: '60px 20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'red' }}>
        {error || 'Invoice not found'}
      </div>
    );
  }

  return <InvoiceTemplate invoice={invoice} items={items} isPrint={true} />;
}
