'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, TrendingUp, Users, Package } from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

/**
 * Intellectual Property Management Page
 * View and manage revenue-generating IP assets
 */
export default function IntellectualPropertyPage() {
  const [ip, setIP] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    ip_type: 'software',
    description: '',
    development_cost: '',
    valuation_estimate: '',
    monetization_model: 'license',
    revenue_generated_monthly: '',
    clients_count: '',
    status: 'active',
  });

  useEffect(() => {
    fetchIP();
  }, []);

  const fetchIP = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/intellectual-property');
      const result = await response.json();
      if (result.success) {
        setIP(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch IP:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIP = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/intellectual-property/${editingId}` : '/api/intellectual-property';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          development_cost: parseFloat(form.development_cost),
          valuation_estimate: form.valuation_estimate ? parseFloat(form.valuation_estimate) : undefined,
          revenue_generated_monthly: form.revenue_generated_monthly ? parseFloat(form.revenue_generated_monthly) : 0,
          clients_count: form.clients_count ? parseInt(form.clients_count) : 0,
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (editingId) {
          setIP(ip.map(item => item.id === editingId ? result.data : item));
        } else {
          setIP([result.data, ...ip]);
        }
        handleCloseModal();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to save IP:', error);
      alert('Failed to save IP');
    }
  };

  const getTotalValuation = () => {
    return ip.reduce((sum, item) => sum + (parseFloat(item.valuation_estimate) || 0), 0);
  };

  const getTotalRevenue = () => {
    return ip.reduce((sum, item) => sum + (parseFloat(item.revenue_generated_lifetime) || 0), 0);
  };

  const getTypeColor = (type) => {
    const colors = {
      software: 'bg-blue-100 text-blue-800',
      internal_system: 'bg-purple-100 text-purple-800',
      licensed_ip: 'bg-green-100 text-green-800',
      brand: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleEditIP = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      ip_type: item.ip_type,
      description: item.description || '',
      development_cost: item.development_cost || '',
      valuation_estimate: item.valuation_estimate || '',
      monetization_model: item.monetization_model || 'license',
      revenue_generated_monthly: item.revenue_generated_monthly || '',
      clients_count: item.clients_count || '',
      status: item.status || 'active',
    });
    setShowModal(true);
  };

  const handleDeleteIP = async (id) => {
    if (!confirm('Are you sure you want to delete this IP asset?')) return;
    try {
      const response = await fetch(`/api/intellectual-property/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setIP(ip.filter(item => item.id !== id));
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to delete IP:', error);
      alert('Failed to delete IP');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({
      name: '',
      ip_type: 'software',
      description: '',
      development_cost: '',
      valuation_estimate: '',
      monetization_model: 'license',
      revenue_generated_monthly: '',
      clients_count: '',
      status: 'active',
    });
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
            <h1 className="text-3xl font-bold text-foreground">Intellectual Property</h1>
            <p className="text-muted-foreground">Manage revenue-generating assets and strategic IP</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({
                name: '',
                ip_type: 'software',
                description: '',
                development_cost: '',
                valuation_estimate: '',
                monetization_model: 'license',
                revenue_generated_monthly: '',
                clients_count: '',
                status: 'active',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            <Plus size={20} /> Add IP Asset
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Valuation</p>
                <p className="text-2xl font-bold text-foreground"><CurrencyDisplay amount={getTotalValuation()} /></p>
              </div>
              <TrendingUp className="text-primary" size={40} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Lifetime Revenue</p>
                <p className="text-2xl font-bold text-foreground"><CurrencyDisplay amount={getTotalRevenue()} /></p>
              </div>
              <Package className="text-secondary" size={40} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Assets</p>
                <p className="text-2xl font-bold text-foreground">{ip.length}</p>
              </div>
              <Users className="text-accent" size={40} />
            </div>
          </div>
        </div>

        {/* IP List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Dev Cost</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Valuation</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Monthly Revenue</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Clients</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ip.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-muted-foreground">
                      No IP assets yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  ip.map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium text-foreground">{item.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(item.ip_type)}`}>
                          {item.ip_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <CurrencyDisplay amount={parseFloat(item.development_cost)} />
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        <CurrencyDisplay amount={item.valuation_estimate || 0} />
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <CurrencyDisplay amount={item.revenue_generated_monthly || 0} />
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.clients_count || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <button 
                          onClick={() => handleEditIP(item)}
                          className="p-1 hover:bg-muted rounded" title="Edit">
                          <Edit size={18} className="text-muted-foreground" />
                        </button>
                        <button 
                          onClick={() => handleDeleteIP(item.id)}
                          className="p-1 hover:bg-muted rounded" title="Delete">
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
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground">{editingId ? 'Edit IP Asset' : 'Create New IP Asset'}</h2>
                <button onClick={handleCloseModal} className="text-muted-foreground hover:text-foreground text-xl">×</button>
              </div>
              <form onSubmit={handleCreateIP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Jeton Platform"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Type *</label>
                  <select
                    value={form.ip_type}
                    onChange={(e) => setForm({ ...form, ip_type: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="software">Software</option>
                    <option value="internal_system">Internal System</option>
                    <option value="licensed_ip">Licensed IP</option>
                    <option value="brand">Brand</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Development Cost *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={form.development_cost}
                    onChange={(e) => setForm({ ...form, development_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Valuation Estimate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valuation_estimate}
                    onChange={(e) => setForm({ ...form, valuation_estimate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
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
                    {editingId ? 'Update' : 'Create'}
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
