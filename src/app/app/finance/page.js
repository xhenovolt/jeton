'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, DollarSign, PieChart, BarChart3 } from 'lucide-react';
import Link from 'next/link';

/**
 * Finance Dashboard
 * Real-time founder view: Revenue, Expenses, Profit, Collections, Pending
 * Answers: "Where is the money? Where does it go?"
 */
export default function FinanceDashboardPage() {
  const [metrics, setMetrics] = useState(null);
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

        const data = await response.json();
        setMetrics(data.data || {});
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
        {!error && metrics && (
          <>
            {/* Top Row - Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Revenue */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(metrics.total_revenue)}
                    </p>
                    <p className="text-green-600 text-sm mt-2">
                      {metrics.invoice_count || 0} invoices
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
                      {formatCurrency(metrics.total_expenses)}
                    </p>
                    <p className="text-red-600 text-sm mt-2">
                      {metrics.expense_items || 0} items
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-red-500 opacity-20" />
                </div>
              </div>

              {/* Net Profit */}
              <div className={`rounded-lg border p-6 hover:shadow-lg transition ${
                (metrics.net_profit || 0) >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      (metrics.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Net Profit
                    </p>
                    <p className={`text-3xl font-bold mt-2 ${
                      (metrics.net_profit || 0) >= 0 ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {formatCurrency(metrics.net_profit)}
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      {formatPercent(metrics.profit_margin)} margin
                    </p>
                  </div>
                  <BarChart3 className={`w-10 h-10 opacity-20 ${
                    (metrics.net_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </div>
              </div>
            </div>

            {/* Collections & Allocations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Collections */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Collections</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Amount Collected</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(metrics.amount_collected)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-gray-600">Pending Collection</span>
                    <span className="text-xl font-bold text-orange-600">
                      {formatCurrency(metrics.pending_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Collection Rate</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatPercent(metrics.collection_rate)}
                    </span>
                  </div>
                </div>
                <Link href="/app/collections" className="mt-4 block px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-center text-sm font-medium hover:bg-blue-100 transition">
                  View Collections
                </Link>
              </div>

              {/* Allocations Breakdown */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Money Allocation</h3>
                <div className="space-y-3">
                  {metrics.allocations && Object.entries(metrics.allocations).map(([type, amount]) => (
                    <div key={type} className="flex justify-between items-center pb-3 border-b border-gray-100">
                      <span className="text-gray-600 capitalize">{type}</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/app/allocations" className="mt-4 block px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-center text-sm font-medium hover:bg-blue-100 transition">
                  Manage Allocations
                </Link>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.expense_categories && Object.entries(metrics.expense_categories).map(([category, amount]) => (
                  <div key={category} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 text-sm capitalize">{category}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatCurrency(amount)}
                    </p>
                  </div>
                ))}
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
