import React from 'react';
import InvoiceList from '@/components/invoice/InvoiceList';

export const metadata = {
  title: 'Invoice Management | Jeton',
  description: 'Create, manage, and track invoices',
};

export default function InvoicesPage() {
  return (
    <main>
      <InvoiceList />
    </main>
  );
}
