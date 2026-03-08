'use client';

/**
 * Payments Page - Money Received
 * Track and allocate payments
 */

import { useState, useEffect } from 'react';
import { 
  Wallet, 
  Search,
  ChevronRight,
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  useEffect(() => {
    async function fetchPayments() {
      try {
        const res = await fetch('/api/payments');
        const data = await res.json();
        if (data.success) {
          setPayments(data.payments || []);
        }
      } catch (error) {
        console.error('Error fetching payments:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.allocation_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    partial: 'bg-blue-100 text-blue-800',
    allocated: 'bg-green-100 text-green-800',
  };

  const statusIcons = {
    pending: <Clock className="w-4 h-4" />,
    partial: <AlertCircle className="w-4 h-4" />,
    allocated: <CheckCircle className="w-4 h-4" />,
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const totalReceived = payments.reduce((sum, p) => sum + parseFloat(p.amount_received || 0), 0);
  const totalAllocated = payments.reduce((sum, p) => sum + parseFloat(p.allocated_amount || 0), 0);
  const pendingAllocation = totalReceived - totalAllocated;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500">Money received and allocation tracking</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-5 h-5" />
          Record Payment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Payments</p>
              <p className="text-xl font-bold">{payments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Received</p>
              <p className="text-xl font-bold">{formatCurrency(totalReceived)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Allocated</p>
              <p className="text-xl font-bold">{formatCurrency(totalAllocated)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Allocation</p>
              <p className="text-xl font-bold">{formatCurrency(pendingAllocation)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="allocated">Allocated</option>
        </select>
      </div>

      {/* Payment List */}
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-700 mb-2">No payments yet</h3>
          <p className="text-gray-500 text-sm">
            Receive payments from contracts
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {payment.date_received 
                      ? new Date(payment.date_received).toLocaleDateString() 
                      : '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium">{payment.client_name || 'Unknown'}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {payment.system_name || '-'}
                  </td>
                  <td className="px-4 py-4 font-medium text-green-600">
                    {formatCurrency(payment.amount_received)}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{formatCurrency(payment.allocated_amount)}</span>
                      {payment.unallocated_amount > 0 && (
                        <span className="text-xs text-yellow-600">
                          ({formatCurrency(payment.unallocated_amount)} pending)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusColors[payment.allocation_status] || 'bg-gray-100'}`}>
                      {statusIcons[payment.allocation_status]}
                      {payment.allocation_status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {payment.payment_method?.replace('_', ' ') || '-'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      Allocate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
