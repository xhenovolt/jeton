/**
 * FinancialDashboard Component
 * Displays founder-level financial metrics and KPIs
 * Shows: revenue, expenses, allocations, profitability, intelligence
 */

'use client';

import { useEffect, useState } from 'react';

export function FinancialDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchDashboard();
  }, [dateRange]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const params = new URLSearchParams(dateRange);
      const response = await fetch(`/api/financial-dashboard?${params}`);
      const data = await response.json();
      if (data.success) {
        setDashboard(data.dashboard);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading financial data...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!dashboard) return null;

  const {
    revenue,
    expenses,
    allocations,
    profitability,
    cash_position,
    data_integrity,
    intelligence,
  } = dashboard;

  return (
    <div className="space-y-8 p-6">
      {/* Header with date range */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Financial Dashboard</h1>
        <div className="flex gap-4">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border rounded"
          />
          <span className="py-2">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border rounded"
          />
        </div>
      </div>

      {/* Data Integrity Alert */}
      {!data_integrity.healthy && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-bold text-red-900 mb-2">⚠️ Data Integrity Issues Detected</h3>
          <ul className="text-red-800 text-sm space-y-1">
            {data_integrity.orphaned_unallocated_payments > 0 && (
              <li>• {data_integrity.orphaned_unallocated_payments} payments with unallocated money</li>
            )}
            {data_integrity.unfinalized_payments > 0 && (
              <li>• {data_integrity.unfinalized_payments} payments not yet finalized</li>
            )}
            {data_integrity.unallocated_amount > 0 && (
              <li>• {data_integrity.unallocated_amount.toLocaleString()} UGX unallocated</li>
            )}
          </ul>
        </div>
      )}

      {/* Revenue Section */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Total Revenue" value={revenue.total_collected} />
        <Card title="Installation Revenue" value={revenue.installation_total} />
        <Card title="Monthly Recurring" value={revenue.monthly_recurring} />
        <Card title="Annual Projection" value={revenue.annual_recurring_projection} />
      </section>

      {/* Profitability Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Expenses" value={expenses.total_expenses} emphasis="negative" />
        <Card title="Net Profit" value={profitability.net_profit} emphasis="positive" />
        <Card 
          title="Profit Margin" 
          value={`${profitability.profit_margin.toFixed(1)}%`}
          emphasis={profitability.profit_margin > 70 ? 'positive' : 'warning'}
        />
      </section>

      {/* Cash Position */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Vault Balance" value={cash_position.vault_balance} />
        <Card title="Operating Balance" value={cash_position.operating_balance} />
        <Card title="Investment Allocated" value={cash_position.investment_allocated} />
      </section>

      {/* Allocations Breakdown */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Where Revenue Went</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(allocations).map(([type, data]) => (
            <div key={type} className="p-4 bg-gray-50 rounded">
              <h3 className="font-bold capitalize">{type}</h3>
              <p className="text-2xl font-bold">{data.total.toLocaleString()} UGX</p>
              <p className="text-gray-600 text-sm">{data.count} allocations</p>
            </div>
          ))}
        </div>
      </section>

      {/* Expenses by Category */}
      {expenses.by_category && expenses.by_category.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Expenses by Category</h2>
          <div className="space-y-3">
            {expenses.by_category.map((category) => (
              <div key={category.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <h4 className="font-bold">{category.name}</h4>
                  <p className="text-gray-600 text-sm">{category.count} expenses</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{category.total.toLocaleString()} UGX</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Systems */}
      {intelligence.top_systems && intelligence.top_systems.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Top Performing Systems</h2>
          <div className="space-y-4">
            {intelligence.top_systems.map((system) => (
              <div key={system.system_id} className="p-4 border rounded">
                <h3 className="font-bold text-lg">{system.system_name}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                  <div>
                    <p className="text-gray-600">Contracts</p>
                    <p className="font-bold">{system.contract_count}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Installation</p>
                    <p className="font-bold">{system.installation_revenue_total.toLocaleString()} UGX</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Monthly Recurring</p>
                    <p className="font-bold">{system.monthly_recurring_total.toLocaleString()} UGX</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Collected</p>
                    <p className="font-bold">{system.total_collected.toLocaleString()} UGX</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Clients */}
      {intelligence.top_clients && intelligence.top_clients.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Top Clients</h2>
          <div className="space-y-3">
            {intelligence.top_clients.map((client) => (
              <div key={client.client_id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <h4 className="font-bold">{client.client_name}</h4>
                  <p className="text-gray-600 text-sm">
                    {client.contract_count} contracts • Last payment: {new Date(client.last_payment_date).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-xl font-bold">{client.total_collected.toLocaleString()} UGX</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * MetricCard Component
 */
function Card({ title, value, emphasis = null }) {
  let bgColor = 'bg-white';
  let textColor = 'text-gray-900';

  if (emphasis === 'positive') {
    bgColor = 'bg-green-50';
    textColor = 'text-green-900';
  } else if (emphasis === 'negative') {
    bgColor = 'bg-red-50';
    textColor = 'text-red-900';
  } else if (emphasis === 'warning') {
    bgColor = 'bg-yellow-50';
    textColor = 'text-yellow-900';
  }

  return (
    <div className={`p-6 rounded-lg shadow ${bgColor}`}>
      <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${textColor}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export default FinancialDashboard;
