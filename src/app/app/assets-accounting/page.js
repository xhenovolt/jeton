'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, TrendingDown, Zap, Building2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

/**
 * Accounting Assets Management Page
 * Manage tangible depreciable assets (laptops, equipment, furniture, etc.)
 */
export default function AssetsAccountingPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    asset_type: 'laptop',
    acquisition_cost: '',
    acquisition_date: '',
    depreciation_method: 'straight_line',
    description: '',
    location: '',
  });

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/assets-accounting');
      const result = await response.json();
      if (result.success) {
        setAssets(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/assets-accounting/${editingId}` : '/api/assets-accounting';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          acquisition_cost: parseFloat(form.acquisition_cost),
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (editingId) {
          setAssets(assets.map(item => item.id === editingId ? result.data : item));
        } else {
          setAssets([result.data, ...assets]);
        }
        setShowModal(false);
        setEditingId(null);
        setForm({
          name: '',
          asset_type: 'laptop',
          acquisition_cost: '',
          acquisition_date: '',
          depreciation_method: 'straight_line',
          description: '',
          location: '',
        });
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to save asset:', error);
      alert('Failed to save asset');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTotalBookValue = () => {
    return assets.reduce((sum, item) => sum + (parseFloat(item.current_book_value) || 0), 0);
  };

  const getTotalDepreciation = () => {
    return assets.reduce((sum, item) => {
      const purchase = parseFloat(item.acquisition_cost) || 0;
      const current = parseFloat(item.current_book_value) || 0;
      return sum + (purchase - current);
    }, 0);
  };

  const handleEditAsset = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      asset_type: item.asset_type,
      acquisition_cost: item.acquisition_cost || '',
      acquisition_date: item.acquisition_date || '',
      depreciation_method: item.depreciation_method || 'straight_line',
      description: item.description || '',
      location: item.location || '',
    });
    setShowModal(true);
  };

  const handleDeleteAsset = async (id) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      const response = await fetchWithAuth(`/api/assets-accounting/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setAssets(assets.filter(item => item.id !== id));
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
      alert('Failed to delete asset');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({
      name: '',
      asset_type: 'laptop',
      acquisition_cost: '',
      acquisition_date: '',
      depreciation_method: 'straight_line',
      description: '',
      location: '',
    });
  };

  const getTypeIcon = (type) => {
    const icons = {
      laptop: '💻',
      phone: '📱',
      equipment: '⚙️',
      furniture: '🪑',
      other: '📦',
    };
    return icons[type] || '📦';
  };

  const getTypeColor = (type) => {
    const colors = {
      laptop: 'bg-blue-100 text-blue-800',
      phone: 'bg-purple-100 text-purple-800',
      equipment: 'bg-orange-100 text-orange-800',
      furniture: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Accounting Assets</h1>
            <p className="text-muted-foreground">Manage tangible depreciable assets for financial reporting</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({
                name: '',
                asset_type: 'laptop',
                acquisition_cost: '',
                acquisition_date: '',
                depreciation_method: 'straight_line',
                description: '',
                location: '',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            <Plus size={20} /> Add Asset
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Book Value</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(getTotalBookValue())}</p>
              </div>
              <Zap className="text-primary" size={40} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Accumulated Depreciation</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(getTotalDepreciation())}</p>
              </div>
              <TrendingDown className="text-red-500" size={40} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Assets</p>
                <p className="text-2xl font-bold text-foreground">{assets.length}</p>
              </div>
              <Building2 className="text-accent" size={40} />
            </div>
          </div>
        </div>

        {/* Assets List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Asset Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Purchase Price</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Book Value</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Method</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Location</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-muted-foreground">
                      No assets yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  assets.map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                        <span>{getTypeIcon(item.asset_type)}</span>
                        {item.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(item.asset_type)}`}>
                          {item.asset_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatCurrency(parseFloat(item.acquisition_cost) || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        {formatCurrency(item.current_book_value || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.depreciation_method}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.location || '—'}</td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <button onClick={() => handleEditAsset(item)} className="p-1 hover:bg-muted rounded" title="Edit">
                          <Edit size={18} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDeleteAsset(item.id)} className="p-1 hover:bg-muted rounded" title="Delete">
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground">{editingId ? 'Edit Asset' : 'Add New Asset'}</h2>
                <button onClick={handleCloseModal} className="text-muted-foreground hover:text-foreground text-xl">×</button>
              </div>
              <form onSubmit={handleCreateAsset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., MacBook Pro"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Type *</label>
                  <select
                    value={form.asset_type}
                    onChange={(e) => setForm({ ...form, asset_type: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="laptop">Laptop</option>
                    <option value="phone">Phone</option>
                    <option value="equipment">Equipment</option>
                    <option value="furniture">Furniture</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Acquisition Date *</label>
                  <input
                    type="date"
                    required
                    value={form.acquisition_date}
                    onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Acquisition Cost *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={form.acquisition_cost}
                    onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Depreciation Method</label>
                  <select
                    value={form.depreciation_method}
                    onChange={(e) => setForm({ ...form, depreciation_method: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="straight_line">Straight Line</option>
                    <option value="accelerated">Accelerated</option>
                    <option value="units_of_production">Units of Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Asset details..."
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Office Desk"
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
                    {editingId ? 'Update Asset' : 'Add Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
