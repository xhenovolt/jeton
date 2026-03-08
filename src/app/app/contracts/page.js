'use client';

/**
 * Contracts Page - Contract Management
 * Won deals become contracts
 */

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Search,
  ChevronRight,
  Plus,
  Building2,
  DollarSign,
  Calendar,
  RefreshCw
} from 'lucide-react';

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  useEffect(() => {
    async function fetchContracts() {
      try {
        const res = await fetch('/api/contracts');
        const data = await res.json();
        if (data.success) {
          setContracts(data.contracts || []);
        }
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchContracts();
  }, []);

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      contract.system_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    terminated: 'bg-red-100 text-red-800',
    expired: 'bg-yellow-100 text-yellow-800',
  };

  const statuses = ['all', 'active', 'draft', 'completed', 'terminated', 'expired'];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const activeCount = contracts.filter(c => c.status === 'active').length;
  const totalValue = contracts.reduce((sum, c) => sum + parseFloat(c.installation_fee || 0), 0);
  const recurringCount = contracts.filter(c => c.recurring_enabled).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-gray-500">Client contracts and agreements</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-5 h-5" />
          New Contract
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Contracts</p>
              <p className="text-xl font-bold">{contracts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-bold">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <RefreshCw className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Recurring</p>
              <p className="text-xl font-bold">{recurringCount}</p>
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
            placeholder="Search contracts..."
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
          {statuses.map(status => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Contract List */}
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-700 mb-2">No contracts yet</h3>
          <p className="text-gray-500 text-sm">
            Win deals to create contracts
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <span className="font-medium">{contract.client_name || 'Unknown'}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {contract.system_name || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium">{formatCurrency(contract.installation_fee)}</span>
                    {contract.recurring_enabled && (
                      <span className="text-xs text-gray-400 ml-1">
                        + {formatCurrency(contract.recurring_amount)}/{contract.recurring_cycle}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {contract.recurring_enabled ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <RefreshCw className="w-4 h-4" />
                        Recurring
                      </span>
                    ) : (
                      <span className="text-gray-500">One-time</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[contract.status] || 'bg-gray-100'}`}>
                      {contract.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {contract.start_date ? new Date(contract.start_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
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
