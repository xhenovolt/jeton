'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, DollarSign, PieChart, BarChart3, Wallet, Building2, Users } from 'lucide-react';
import Link from 'next/link';

/**
 * Finance Dashboard
 * Real-time founder view: Revenue, Expenses, Profit, Collections, Pending
 * Answers: "Where is the money? Where does it go?"
 */
export default function FinanceDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('month'); // month | quarter | year | all

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/financial-dashboard?range=${dateRange}`);

        if (!response.ok) {
          throw new Error('Failed to fetch financial metrics');
        }

        const json = await response.json();
        if (json.success) {
          setData(json.dashboard || {});
        } else {
          throw new Error(json.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [dateRange]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading financial metrics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time view of money in, expenses, and profit</p>
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-2 mb-6">
          {[
            { label: 'This Month', value: 'month' },
            { label: 'This Quarter', value: 'quarter' },
            { label: 'This Year', value: 'year' },
            { label: 'All Time', value: 'all' },
          ].map((btn) => (
            <button
              key={btn.value}
              onClick={() => setDateRange(btn.value)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                dateRange === btn.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error loading metrics</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* KPI Cards Grid */}
        {!error && data && (
          <>
            {/* Top Row - Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Revenue */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(data.revenue?.total_collected)}
                    </p>
                    <p className="text-green-600 text-sm mt-2">
                      {data.revenue?.payment_count || 0} payments
                    </p>
                  </div>
                  <DollarSign className="w-10 h-10 text-green-500 opacity-20" />
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Expenses</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(data.expenses?.total_expenses)}
                    </p>
                    <p className="text-red-600 text-sm mt-2">
                      {data.expenses?.expense_count || 0} items
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-red-500 opacity-20" />
                </div>
              </div>

              {/* Net Profit */}
              <div className={`rounded-lg border p-6 hover:shadow-lg transition ${
                (data.profitability?.net_profit || 0) >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      (data.profitability?.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Net Profit
                    </p>
                    <p className={`text-3xl font-bold mt-2 ${
                      (data.profitability?.net_profit || 0) >= 0 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {formatCurrency(data.profitability?.net_profit)}
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      {formatPercent(data.profitability?.profit_margin)} margin
                    </p>
                  </div>
                  <BarChart3 className={`w-10 h-10 opacity-20 ${
                    (data.profitability?.net_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </div>
              </div>
            </div>

            {/* Cash Position & Allocations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Cash Position */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-600" />
                  Cash Position
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Vault Balance</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(data.cash_position?.vault_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Operating Balance</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(data.cash_position?.operating_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Investment Allocated</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(data.cash_position?.investment_allocated)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-900 font-medium">Total Allocated</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(data.cash_position?.total_allocated)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Recurring */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Recurring Revenue
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Monthly Recurring</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(data.revenue?.monthly_recurring)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Annual Projection</span>
                    <span className="text-xl font-bold text-purple-600">
                      {formatCurrency(data.revenue?.annual_recurring_projection)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Active Contracts</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {data.revenue?.contracts_with_revenue || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Systems & Clients */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Top Systems */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Top Systems by Revenue
                </h3>
                <div className="space-y-3">
                  {data.intelligence?.top_systems?.length > 0 ? (
                    data.intelligence.top_systems.map((sys, i) => (
                      <div key={sys.system_id || i} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-gray-900 font-medium">{sys.system_name || 'Unknown'}</p>
                          <p className="text-gray-500 text-sm">{sys.active_clients || 0} clients</p>
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrency(sys.installation_revenue_total + (sys.monthly_recurring_total * 12))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No system revenue data</p>
                  )}
                </div>
              </div>

              {/* Top Clients */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  Top Clients by Revenue
                </h3>
                <div className="space-y-3">
                  {data.intelligence?.top_clients?.length > 0 ? (
                    data.intelligence.top_clients.map((client, i) => (
                      <div key={client.client_id || i} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-gray-900 font-medium">{client.client_name || 'Unknown'}</p>
                          <p className="text-gray-500 text-sm">{client.contract_count || 0} contracts</p>
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrency(client.total_collected)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No client revenue data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Data Integrity Alert */}
            {data.data_integrity && !data.data_integrity.healthy && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900">Attention Needed</h3>
                  <p className="text-yellow-700 text-sm">
                    {data.data_integrity.orphaned_unallocated_payments > 0 && 
                      `${data.data_integrity.orphaned_unallocated_payments} payment(s) have unallocated amounts. `}
                    {data.data_integrity.unfinalized_payments > 0 && 
                      `${data.data_integrity.unfinalized_payments} payment(s) pending allocation (${formatCurrency(data.data_integrity.unallocated_amount)}). `}
                  </p>
                  <Link href="/app/payments" className="text-yellow-800 underline text-sm">
                    Review Payments
                  </Link>
                </div>
              </div>
            )}

            {/* Expense Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.expenses?.by_category?.length > 0 ? (
                  data.expenses.by_category.filter(cat => cat.total > 0).map((cat) => (
                    <div key={cat.id} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 text-sm capitalize">{cat.name}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">
                        {formatCurrency(cat.total)}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">{cat.count} items</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm col-span-3">No expenses recorded</p>
                )}
              </div>
              <Link href="/app/expenses" className="mt-4 block px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-center text-sm font-medium hover:bg-blue-100 transition">
                Manage Expenses
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
