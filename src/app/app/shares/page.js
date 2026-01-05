'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, TrendingUp, Users, Percent, DollarSign, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

/**
 * Share Management Page - Investor Grade Equity System
 * 
 * CRITICAL ARCHITECTURE:
 * - Company Valuation is SYNCED from Dashboard (Single Source of Truth)
 * - Valuation breakdown: Accounting Net Worth + IP Value + Infrastructure
 * - Price Per Share = Strategic Company Value / Authorized Shares (derived, not manual)
 * - Ownership % and share value update automatically when valuation changes
 * 
 * Philosophy: Jeton is one interconnected executive system, not disconnected modules
 */
export default function SharesPage() {
  const [shareConfig, setShareConfig] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showWarning, setShowWarning] = useState(null);
  const [showValuationBreakdown, setShowValuationBreakdown] = useState(false);

  const [form, setForm] = useState({
    owner_name: '',
    owner_email: '',
    shares_allocated: '',
    allocation_date: new Date().toISOString().split('T')[0],
    vesting_start_date: '',
    vesting_end_date: '',
    vesting_percentage: 100,
    notes: '',
  });

  const [configForm, setConfigForm] = useState({
    authorized_shares: '',
  });

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds to match Dashboard cadence
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);
      setRefreshing(true);

      // Create abort controller with 30-second timeout (increased for cold connections)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const [sharesRes, allocRes] = await Promise.all([
        fetch('/api/shares', { signal: controller.signal }),
        fetch('/api/shares/allocations', { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      if (!sharesRes.ok || !allocRes.ok) {
        console.error('API Error:', { sharesStatus: sharesRes.status, allocStatus: allocRes.status });
        setError('Failed to load share data. Please try again.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const sharesData = await sharesRes.json();
      const allocData = await allocRes.json();

      if (sharesData.success && sharesData.data) {
        setShareConfig(sharesData.data);
        // Initialize config form with current authorized shares
        setConfigForm({
          authorized_shares: sharesData.data.authorized_shares.toString(),
        });
      }

      if (allocData.success && Array.isArray(allocData.data)) {
        setAllocations(allocData.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateAllocation = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/shares/allocations/${editingId}` : '/api/shares/allocations';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          shares_allocated: parseInt(form.shares_allocated),
          vesting_percentage: parseFloat(form.vesting_percentage),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowModal(false);
        setEditingId(null);
        resetForm();
        await fetchData();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to save allocation:', error);
      alert('Failed to save allocation');
    }
  };

  const handleEditAllocation = (item) => {
    setEditingId(item.id);
    setForm({
      owner_name: item.owner_name,
      owner_email: item.owner_email || '',
      shares_allocated: item.shares_allocated.toString(),
      allocation_date: item.allocation_date,
      vesting_start_date: item.vesting_start_date || '',
      vesting_end_date: item.vesting_end_date || '',
      vesting_percentage: item.vesting_percentage || 100,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleDeleteAllocation = async (id) => {
    try {
      const response = await fetch(`/api/shares/allocations/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setShowDeleteConfirm(null);
        await fetchData();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to delete allocation:', error);
      alert('Failed to delete allocation');
    }
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    
    const newAuthorizedShares = parseInt(configForm.authorized_shares);

    // Warn if reducing authorized shares below allocated
    if (newAuthorizedShares < shareConfig.authorized_shares && shareConfig.shares_allocated > 0) {
      setShowWarning({
        type: 'shares_reduction',
        newShares: newAuthorizedShares,
        allocated: shareConfig.shares_allocated,
        onConfirm: () => submitConfigUpdate(newAuthorizedShares),
      });
      return;
    }

    submitConfigUpdate(newAuthorizedShares);
  };

  const submitConfigUpdate = async (authorizedShares) => {
    try {
      const response = await fetch('/api/shares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorized_shares: authorizedShares,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowConfigModal(false);
        setShowWarning(null);
        await fetchData();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
      alert('Failed to update equity structure');
    }
  };

  const resetForm = () => {
    setForm({
      owner_name: '',
      owner_email: '',
      shares_allocated: '',
      allocation_date: new Date().toISOString().split('T')[0],
      vesting_start_date: '',
      vesting_end_date: '',
      vesting_percentage: 100,
      notes: '',
    });
    setEditingId(null);
  };

  if (loading || !shareConfig) {
    return <div className="p-6 text-center">Loading equity structure...</div>;
  }

  const strategicValue = shareConfig.valuation?.strategic_company_value || 0;
  const pricePerShare = shareConfig.price_per_share || 0;
  const previewShares = form.shares_allocated ? parseInt(form.shares_allocated) : 0;
  const previewOwnership = shareConfig.authorized_shares > 0 
    ? (previewShares / shareConfig.authorized_shares) * 100 
    : 0;
  const previewValue = previewShares * pricePerShare;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Cap Table & Share Management</h1>
          <p className="text-muted-foreground">Investor-grade equity system with live valuation sync</p>
        </div>

        {/* Valuation Sync Status */}
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <div>
            <p className="font-semibold text-green-900">Live (auto-updated every 30s)</p>
            <p className="text-sm text-green-800">Synced from Executive Valuation Dashboard</p>
          </div>
        </div>

        {/* Metrics Grid - 4 Primary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Strategic Company Value */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-gray-600 text-sm font-semibold mb-2">STRATEGIC VALUE</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              <CurrencyDisplay amount={strategicValue} />
            </p>
            <p className="text-xs text-gray-500">Synced from Dashboard</p>
          </div>

          {/* Authorized Shares */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-gray-600 text-sm font-semibold mb-2">AUTHORIZED SHARES</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{shareConfig.authorized_shares}</p>
            <p className="text-xs text-gray-500">Controls scarcity</p>
          </div>

          {/* Price Per Share */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-gray-600 text-sm font-semibold mb-2">PRICE PER SHARE</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              <CurrencyDisplay amount={pricePerShare} />
            </p>
            <p className="text-xs text-gray-500">Value ÷ Authorized</p>
          </div>

          {/* Allocation Status */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-gray-600 text-sm font-semibold mb-2">ALLOCATION STATUS</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {shareConfig.shares_allocated}/{shareConfig.authorized_shares}
            </p>
            <p className="text-xs text-gray-500">{shareConfig.shares_remaining} remaining</p>
          </div>
        </div>

        {/* Valuation Breakdown (Collapsed) */}
        <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
          <button
            onClick={() => setShowValuationBreakdown(!showValuationBreakdown)}
            className="w-full p-4 flex items-center justify-between hover:bg-purple-100/50 transition"
          >
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-purple-600" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Valuation Bridge Preview</p>
                <p className="text-xs text-gray-600">How strategic value is calculated</p>
              </div>
            </div>
            {showValuationBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showValuationBreakdown && (
            <div className="px-4 pb-4 border-t border-purple-200 pt-4 space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded">
                <span className="text-gray-700">Accounting Net Worth</span>
                <span className="font-semibold">
                  <CurrencyDisplay amount={shareConfig.valuation?.accounting_net_worth || 0} />
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded">
                <span className="text-gray-700">+ Strategic IP Value</span>
                <span className="font-semibold text-blue-600">
                  +<CurrencyDisplay amount={shareConfig.valuation?.total_ip_valuation || 0} />
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded">
                <span className="text-gray-700">+ Infrastructure Value</span>
                <span className="font-semibold text-green-600">
                  +<CurrencyDisplay amount={shareConfig.valuation?.infrastructure_value || 0} />
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded font-bold">
                <span>= Final Strategic Value</span>
                <span><CurrencyDisplay amount={strategicValue} /></span>
              </div>
            </div>
          )}
        </div>

        {/* Configure Button */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <DollarSign size={18} />
            Configure Authorized Shares
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
          >
            <Plus size={18} />
            Allocate Shares
          </button>
        </div>

        {/* Cap Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-lg text-gray-900">Cap Table</h2>
          </div>
          
          {allocations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users size={48} className="mx-auto mb-3 opacity-50" />
              <p>No share allocations yet</p>
              <p className="text-sm mt-2">Click "Allocate Shares" to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Owner</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Shares</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Ownership %</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Share Value</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allocations.map(allocation => (
                    <tr key={allocation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{allocation.owner_name}</p>
                        {allocation.owner_email && <p className="text-xs text-gray-500">{allocation.owner_email}</p>}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">{allocation.shares_allocated}</td>
                      <td className="px-6 py-4 text-right font-semibold text-blue-600">{allocation.ownership_percentage}%</td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                        <CurrencyDisplay amount={allocation.share_value} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleEditAllocation(allocation)}
                          className="text-blue-600 hover:text-blue-800 mr-3 inline"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(allocation.id)}
                          className="text-red-600 hover:text-red-800 inline"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-6 py-4 text-gray-900">TOTAL</td>
                    <td className="px-6 py-4 text-right text-gray-900">{shareConfig.shares_allocated}</td>
                    <td className="px-6 py-4 text-right text-gray-900">{shareConfig.allocation_percentage.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      <CurrencyDisplay amount={strategicValue * (shareConfig.allocation_percentage / 100)} />
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? 'Edit Allocation' : 'Allocate Shares'}
                </h2>
              </div>

              <form onSubmit={handleCreateAllocation} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Owner Name *</label>
                    <input
                      type="text"
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={form.owner_email}
                      onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Shares to Allocate *</label>
                    <input
                      type="number"
                      value={form.shares_allocated}
                      onChange={(e) => setForm({ ...form, shares_allocated: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Allocation Date *</label>
                    <input
                      type="date"
                      value={form.allocation_date}
                      onChange={(e) => setForm({ ...form, allocation_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Live Preview */}
                {previewShares > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-3">Preview</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-blue-700">Ownership %</p>
                        <p className="text-2xl font-bold text-blue-900">{previewOwnership.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Share Price</p>
                        <p className="text-lg font-bold text-blue-900">
                          <CurrencyDisplay amount={pricePerShare} />
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Total Value</p>
                        <p className="text-lg font-bold text-blue-900">
                          <CurrencyDisplay amount={previewValue} />
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vesting Start</label>
                    <input
                      type="date"
                      value={form.vesting_start_date}
                      onChange={(e) => setForm({ ...form, vesting_start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vesting End</label>
                    <input
                      type="date"
                      value={form.vesting_end_date}
                      onChange={(e) => setForm({ ...form, vesting_end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    {editingId ? 'Update' : 'Allocate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Configure Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Configure Equity Structure</h2>
              </div>

              <form onSubmit={handleUpdateConfig} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Authorized Shares *</label>
                  <input
                    type="number"
                    value={configForm.authorized_shares}
                    onChange={(e) => setConfigForm({ ...configForm, authorized_shares: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Controls the scarcity and denominator for price-per-share calculation</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Company Valuation</p>
                  <p className="text-2xl font-bold text-blue-900 mb-2">
                    <CurrencyDisplay amount={strategicValue} />
                  </p>
                  <p className="text-xs text-blue-700 flex items-center gap-2">
                    <Zap size={14} />
                    Synced from Executive Valuation Dashboard (read-only)
                  </p>
                  <p className="text-xs text-blue-700 mt-2">To influence valuation, update underlying assets, IP value, or infrastructure in the dashboard.</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-900 mb-2">Price Per Share Preview</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    <CurrencyDisplay amount={pricePerShare} />
                  </p>
                  <p className="text-xs text-emerald-700 mt-2">
                    {strategicValue.toLocaleString('en-US')} ÷ {configForm.authorized_shares || shareConfig.authorized_shares} = <CurrencyDisplay amount={pricePerShare} />
                  </p>
                </div>

                {parseInt(configForm.authorized_shares || shareConfig.authorized_shares) < shareConfig.authorized_shares && shareConfig.shares_allocated > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                    <AlertCircle size={20} className="text-yellow-700 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-900">Warning</p>
                      <p className="text-xs text-yellow-800 mt-1">
                        Reducing to {configForm.authorized_shares} shares will leave zero remaining capacity ({shareConfig.shares_allocated} already allocated)
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        {showWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6 border-b border-yellow-200 bg-yellow-50">
                <div className="flex gap-3">
                  <AlertCircle size={24} className="text-yellow-700 flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-yellow-900">Shares Reduction Warning</h2>
                    <p className="text-sm text-yellow-800 mt-1">
                      You're reducing authorized shares from {shareConfig.authorized_shares} to {showWarning.newShares}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Current Allocations</p>
                  <p className="text-2xl font-bold text-gray-900">{shareConfig.shares_allocated}/{shareConfig.authorized_shares} shares</p>
                  <p className="text-sm text-gray-600 mt-2">Remaining After Change</p>
                  <p className="text-2xl font-bold text-red-600">{showWarning.newShares - shareConfig.shares_allocated} shares</p>
                </div>

                <p className="text-sm text-gray-700">
                  This action will leave {showWarning.newShares - shareConfig.shares_allocated} shares available for future allocation.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => showWarning.onConfirm()}
                    className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition font-semibold"
                  >
                    Proceed Anyway
                  </button>
                  <button
                    onClick={() => setShowWarning(null)}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-sm w-full">
              <div className="p-6 border-b border-red-200 bg-red-50">
                <h2 className="text-xl font-bold text-red-900">Delete Allocation?</h2>
              </div>

              <div className="p-6">
                <p className="text-gray-700 mb-6">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteAllocation(showDeleteConfirm)}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-semibold"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
