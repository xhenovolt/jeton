'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, TrendingUp, Users, Percent, DollarSign, AlertCircle } from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

/**
 * Share Management Page - Investor Grade Equity System
 * 
 * Core Model:
 * - Authorized Shares: Maximum shares you'll ever issue (controls scarcity)
 * - Company Valuation: Your company's total value in UGX  
 * - Price Per Share = Company Valuation / Authorized Shares (auto-calculated)
 * - Ownership % = (Shares Owned / Authorized Shares) × 100%
 */
export default function SharesPage() {
  const [shareConfig, setShareConfig] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showWarning, setShowWarning] = useState(null);

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
    company_valuation: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const [sharesRes, allocRes] = await Promise.all([
          fetch('/api/shares', { signal: controller.signal }),
          fetch('/api/shares/allocations', { signal: controller.signal }),
        ]);

        clearTimeout(timeoutId);

        const sharesData = sharesRes.ok ? await sharesRes.json() : { success: false };
        const allocData = allocRes.ok ? await allocRes.json() : { success: false, data: [] };

        if (sharesData.success && sharesData.data) {
          setShareConfig(sharesData.data);
        } else {
          setShareConfig({
            authorized_shares: 100,
            company_valuation: 0,
            shares_allocated: 0,
            shares_remaining: 100,
            price_per_share: 0,
            allocation_percentage: 0,
          });
        }

        if (allocData.success && Array.isArray(allocData.data)) {
          setAllocations(allocData.data);
        } else {
          setAllocations([]);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        setShareConfig({
          authorized_shares: 100,
          company_valuation: 0,
          shares_allocated: 0,
          shares_remaining: 100,
          price_per_share: 0,
          allocation_percentage: 0,
        });
        setAllocations([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
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
    const newValuation = parseFloat(configForm.company_valuation);

    // Warn if reducing authorized shares below allocated
    if (newAuthorizedShares < shareConfig.authorized_shares && shareConfig.shares_allocated > 0) {
      setShowWarning({
        type: 'shares_reduction',
        newShares: newAuthorizedShares,
        allocated: shareConfig.shares_allocated,
        onConfirm: () => submitConfigUpdate(newAuthorizedShares, newValuation),
      });
      return;
    }

    submitConfigUpdate(newAuthorizedShares, newValuation);
  };

  const submitConfigUpdate = async (authorizedShares, valuation) => {
    try {
      const response = await fetch('/api/shares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorized_shares: authorizedShares,
          company_valuation: valuation,
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
      alert('Failed to update configuration');
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
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    resetForm();
  };

  if (loading) {
    return <div className="p-6 text-center">Loading shares data...</div>;
  }

  const totalAllocationValue = allocations.reduce(
    (sum, a) => sum + (a.share_value || 0),
    0
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Share Management</h1>
          <p className="text-muted-foreground">Investor-grade equity cap table system</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {/* Authorized Shares */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-semibold">AUTHORIZED SHARES</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {shareConfig?.authorized_shares?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Max to issue</p>
              </div>
              <DollarSign className="text-blue-600" size={28} />
            </div>
          </div>

          {/* Company Valuation */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-semibold">COMPANY VALUATION</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  <CurrencyDisplay amount={shareConfig?.company_valuation || 0} className="text-2xl" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total value</p>
              </div>
              <TrendingUp className="text-green-600" size={28} />
            </div>
          </div>

          {/* Price Per Share */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
            <div>
              <p className="text-purple-600 dark:text-purple-400 text-sm font-semibold">PRICE PER SHARE</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                <CurrencyDisplay amount={shareConfig?.price_per_share || 0} className="text-2xl" />
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Auto-calculated</p>
            </div>
          </div>

          {/* Allocated Shares */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-semibold">ALLOCATED</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {shareConfig?.shares_allocated?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {shareConfig?.allocation_percentage?.toFixed(1) || 0}%
                </p>
              </div>
              <Users className="text-orange-600" size={28} />
            </div>
          </div>

          {/* Remaining Shares */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-semibold">REMAINING</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {shareConfig?.shares_remaining?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Available</p>
              </div>
              <Percent className="text-teal-600" size={28} />
            </div>
          </div>
        </div>

        {/* Configuration Button */}
        <div className="mb-8">
          <button
            onClick={() => {
              setConfigForm({
                authorized_shares: shareConfig?.authorized_shares?.toString() || '100',
                company_valuation: shareConfig?.company_valuation?.toString() || '0',
              });
              setShowConfigModal(true);
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition"
          >
            Configure Equity Structure
          </button>
        </div>

        {/* Allocations Table */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Share Allocations</h2>
              <p className="text-sm text-muted-foreground">
                Total allocated: <CurrencyDisplay amount={totalAllocationValue} />
              </p>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
            >
              <Plus size={20} /> Allocate Shares
            </button>
          </div>

          {allocations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No share allocations yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-3 text-left font-semibold text-foreground">Owner</th>
                    <th className="px-6 py-3 text-right font-semibold text-foreground">Shares</th>
                    <th className="px-6 py-3 text-right font-semibold text-foreground">Ownership %</th>
                    <th className="px-6 py-3 text-right font-semibold text-foreground">Value (UGX)</th>
                    <th className="px-6 py-3 text-center font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => (
                    <tr key={alloc.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-foreground">{alloc.owner_name}</p>
                          {alloc.owner_email && <p className="text-xs text-muted-foreground">{alloc.owner_email}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">{alloc.shares_allocated.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold text-foreground">
                        {alloc.ownership_percentage}%
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-600">
                        <CurrencyDisplay amount={alloc.share_value} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleEditAllocation(alloc)}
                          className="inline-block p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(alloc.id)}
                          className="inline-block p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ml-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {allocations.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/50">
                      <td colSpan="2" className="px-6 py-4 font-bold text-foreground">TOTAL</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {shareConfig?.allocation_percentage?.toFixed(1) || 0}%
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-purple-600">
                        <CurrencyDisplay amount={totalAllocationValue} />
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Allocation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {editingId ? 'Edit Allocation' : 'Allocate Shares'}
              </h2>
              <form onSubmit={handleCreateAllocation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={form.owner_email}
                    onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Shares to Allocate * (max: {shareConfig?.shares_remaining?.toLocaleString()})
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={shareConfig?.shares_remaining || 0}
                    value={form.shares_allocated}
                    onChange={(e) => setForm({ ...form, shares_allocated: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 20"
                  />
                  {form.shares_allocated && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <p>Ownership: {((parseInt(form.shares_allocated) / shareConfig?.authorized_shares) * 100).toFixed(2)}%</p>
                      <p>Value: <CurrencyDisplay amount={parseInt(form.shares_allocated) * shareConfig?.price_per_share} /></p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Allocation Date</label>
                  <input
                    type="date"
                    value={form.allocation_date}
                    onChange={(e) => setForm({ ...form, allocation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Vesting Start Date</label>
                  <input
                    type="date"
                    value={form.vesting_start_date}
                    onChange={(e) => setForm({ ...form, vesting_start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Vesting End Date</label>
                  <input
                    type="date"
                    value={form.vesting_end_date}
                    onChange={(e) => setForm({ ...form, vesting_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Vesting Percentage</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.vesting_percentage}
                    onChange={(e) => setForm({ ...form, vesting_percentage: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    rows="3"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    {editingId ? 'Update' : 'Allocate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Configuration Modal */}
        {showConfigModal && !showWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-foreground mb-2">Configure Equity</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Lower authorized shares = higher per-share value. Fewer, more valuable shares.
              </p>

              <form onSubmit={handleUpdateConfig} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Authorized Shares *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={configForm.authorized_shares}
                    onChange={(e) => setConfigForm({ ...configForm, authorized_shares: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max shares ever. Cannot go below {shareConfig?.shares_allocated} allocated.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Company Valuation (UGX) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000000"
                    value={configForm.company_valuation}
                    onChange={(e) => setConfigForm({ ...configForm, company_valuation: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 1000000000"
                  />
                </div>

                {configForm.authorized_shares && configForm.company_valuation && (
                  <div className="bg-muted p-4 rounded-lg border border-border">
                    <p className="text-sm font-semibold text-foreground mb-2">Preview:</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Price Per Share:</span>
                        <span className="font-bold text-purple-600">
                          <CurrencyDisplay amount={parseFloat(configForm.company_valuation) / parseInt(configForm.authorized_shares)} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Warning Modal for Reducing Shares */}
        {showWarning?.type === 'shares_reduction' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-yellow-600 rounded-lg p-6 max-w-md w-full">
              <div className="flex gap-3 mb-4">
                <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
                <div>
                  <h2 className="text-lg font-bold text-foreground">Reduce Authorized Shares?</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reducing from {shareConfig?.authorized_shares} to {showWarning.newShares}, but {showWarning.allocated} already allocated.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mb-4">
                <p className="text-sm text-yellow-900 dark:text-yellow-200">
                  ⚠️ No room for future allocations. Ownership % will adjust.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowWarning(null)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => showWarning.onConfirm()}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full">
              <h2 className="text-lg font-bold text-foreground mb-4">Delete Allocation?</h2>
              <p className="text-muted-foreground mb-6">This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAllocation(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
