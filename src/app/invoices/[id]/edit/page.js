'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InvoiceForm from '@/components/invoice/InvoiceForm';

export default function EditInvoicePage({ params }) {
  const { id } = params;
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);
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
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#666' }}>
          Loading invoice...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#666' }}>
          <p>{error || 'Invoice not found'}</p>
          <Link href="/invoices">
            <button
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ← Back to Invoices
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <Link href="/invoices">
          <button
            style={{
              padding: '10px 20px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            ← Back to Invoices
          </button>
        </Link>
      </div>

      <h1 style={{ color: '#0f3c2e', marginBottom: '30px' }}>Edit Invoice</h1>

      <InvoiceForm
        initialData={invoice}
        onSubmitSuccess={() => {
          router.push('/invoices');
        }}
      />
    </div>
  );
}
