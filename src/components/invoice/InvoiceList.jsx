'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InvoiceForm from '@/components/invoice/InvoiceForm';
import InvoiceTemplate from '@/components/invoice/InvoiceTemplate';
import './InvoiceList.css';

export default function InvoiceList() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'view'
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [currentPage, filterStatus]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/invoices', window.location.origin);
      url.searchParams.set('page', currentPage);
      url.searchParams.set('limit', pageSize);
      if (filterStatus) {
        url.searchParams.set('status', filterStatus);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.success) {
        setInvoices(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/invoices/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDelete = async (invoiceId) => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchInvoices();
        fetchStats();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handlePrint = (invoice) => {
    const printWindow = window.open(`/invoices/${invoice.id}/print`, '_blank');
    printWindow.print();
  };

  const formatCurrency = (value, currency = 'UGX') => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#95a5a6',
      sent: '#3498db',
      paid: '#27ae60',
      partially_paid: '#f39c12',
      overdue: '#e74c3c',
      cancelled: '#7f8c8d',
    };
    return colors[status] || '#95a5a6';
  };

  const filteredAndSearchedInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (viewMode === 'create') {
    return (
      <div className="invoice-container">
        <div className="page-header">
          <h1>Create New Invoice</h1>
          <button
            className="btn-back"
            onClick={() => {
              setViewMode('list');
              fetchInvoices();
              fetchStats();
            }}
          >
            ← Back to List
          </button>
        </div>
        <InvoiceForm
          onSubmitSuccess={() => {
            setViewMode('list');
            fetchInvoices();
            fetchStats();
          }}
        />
      </div>
    );
  }

  if (viewMode === 'view' && selectedInvoice) {
    return (
      <div className="invoice-container">
        <div className="page-header">
          <h1>Invoice: {selectedInvoice.invoice_number}</h1>
          <button
            className="btn-back"
            onClick={() => {
              setViewMode('list');
              setSelectedInvoice(null);
            }}
          >
            ← Back to List
          </button>
        </div>

        <div className="invoice-view-actions">
          <button
            className="btn-action btn-print"
            onClick={() => handlePrint(selectedInvoice)}
          >
            🖨️ Print
          </button>
          <button
            className="btn-action btn-download"
            onClick={() => window.location.href = `/invoices/${selectedInvoice.id}/pdf`}
          >
            📥 Download PDF
          </button>
          <Link href={`/invoices/${selectedInvoice.id}/edit`}>
            <button className="btn-action btn-edit">✏️ Edit</button>
          </Link>
        </div>

        <InvoiceTemplate invoice={selectedInvoice} items={selectedInvoice.items || []} />
      </div>
    );
  }

  return (
    <div className="invoice-container">
      <div className="page-header">
        <div>
          <h1>Invoice Management</h1>
          <p className="subtitle">Manage all your invoices in one place</p>
        </div>
        <button className="btn-create" onClick={() => setViewMode('create')}>
          ➕ Create Invoice
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Invoices</div>
            <div className="stat-value">{stats.total_invoices || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Amount</div>
            <div className="stat-value">{formatCurrency(stats.total_amount || 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Paid</div>
            <div className="stat-value paid">{formatCurrency(stats.total_paid || 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value pending">{formatCurrency(stats.total_pending || 0)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by invoice number or client name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${!filterStatus ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('');
              setCurrentPage(1);
            }}
          >
            All ({stats?.total_invoices || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'draft' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('draft');
              setCurrentPage(1);
            }}
          >
            Draft ({stats?.draft_count || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'sent' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('sent');
              setCurrentPage(1);
            }}
          >
            Sent ({stats?.sent_count || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'partially_paid' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('partially_paid');
              setCurrentPage(1);
            }}
          >
            Partially Paid ({stats?.partially_paid_count || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'paid' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('paid');
              setCurrentPage(1);
            }}
          >
            Paid ({stats?.paid_count || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'overdue' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('overdue');
              setCurrentPage(1);
            }}
          >
            Overdue ({stats?.overdue_count || 0})
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-section">
        {loading ? (
          <div className="loading">Loading invoices...</div>
        ) : filteredAndSearchedInvoices.length === 0 ? (
          <div className="empty-state">
            <p>No invoices found</p>
            <button className="btn-create" onClick={() => setViewMode('create')}>
              Create your first invoice
            </button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="invoices-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSearchedInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="invoice-number">
                        <strong>{invoice.invoice_number}</strong>
                      </td>
                      <td>{invoice.client_name}</td>
                      <td>{formatDate(invoice.issue_date)}</td>
                      <td className="amount">{formatCurrency(invoice.total)} UGX</td>
                      <td>
                        <select
                          className="status-select"
                          value={invoice.status}
                          onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                          style={{ borderColor: getStatusColor(invoice.status) }}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="partially_paid">Partially Paid</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="balance">
                        {formatCurrency(invoice.balance_due)} UGX
                      </td>
                      <td className="actions">
                        <button
                          className="btn-icon btn-view"
                          title="View"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setViewMode('view');
                          }}
                        >
                          👁️
                        </button>
                        <Link href={`/invoices/${invoice.id}/edit`}>
                          <button className="btn-icon btn-edit" title="Edit">
                            ✏️
                          </button>
                        </Link>
                        <button
                          className="btn-icon btn-print"
                          title="Print"
                          onClick={() => handlePrint(invoice)}
                        >
                          🖨️
                        </button>
                        <button
                          className="btn-icon btn-download"
                          title="Download PDF"
                          onClick={() => window.location.href = `/invoices/${invoice.id}/pdf`}
                        >
                          📥
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          title="Delete"
                          onClick={() => handleDelete(invoice.id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn-pagination"
                >
                  ← Previous
                </button>

                <div className="page-info">
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-pagination"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
