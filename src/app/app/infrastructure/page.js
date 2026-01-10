'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Shield, Globe, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

/**
 * Infrastructure Management Page
 * Manage operational foundations (domains, social media, design systems, brand assets)
 */
export default function InfrastructurePage() {
  const [infrastructure, setInfrastructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    infrastructure_type: 'website',
    description: '',
    risk_level: 'medium',
    replacement_cost: '',
    recovery_procedures: '',
    owner_name: '',
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchInfrastructure();
  }, []);

  const fetchInfrastructure = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/infrastructure');
      const result = await response.json();
      if (result.success) {
        setInfrastructure(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch infrastructure:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInfra = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/infrastructure/${editingId}` : '/api/infrastructure';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          replacement_cost: form.replacement_cost ? parseFloat(form.replacement_cost) : 0,
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (editingId) {
          setInfrastructure(infrastructure.map(item => item.id === editingId ? result.data : item));
        } else {
          setInfrastructure([result.data, ...infrastructure]);
        }
        setShowModal(false);
        setEditingId(null);
        setForm({
          name: '',
          infrastructure_type: 'website',
          description: '',
          risk_level: 'medium',
          replacement_cost: '',
          recovery_procedures: '',
          owner_name: '',
        });
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to save infrastructure:', error);
      alert('Failed to save infrastructure');
    }
  };

  const getTotalReplacementCost = () => {
    return infrastructure.reduce((sum, item) => sum + (parseFloat(item.replacement_cost) || 0), 0);
  };

  const getCriticalCount = () => {
    return infrastructure.filter((item) => item.risk_level === 'critical').length;
  };

  const handleEditInfra = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      infrastructure_type: item.infrastructure_type,
      description: item.description || '',
      risk_level: item.risk_level,
      replacement_cost: item.replacement_cost || '',
      recovery_procedures: item.recovery_procedures || '',
      owner_name: item.owner_name || '',
    });
    setShowModal(true);
  };

  const handleDeleteInfra = async (id) => {
    if (!confirm('Are you sure you want to delete this infrastructure item?')) return;
    try {
      const response = await fetchWithAuth(`/api/infrastructure/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setInfrastructure(infrastructure.filter(item => item.id !== id));
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to delete infrastructure:', error);
      alert('Failed to delete infrastructure');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({
      name: '',
      infrastructure_type: 'website',
      description: '',
      risk_level: 'medium',
      replacement_cost: '',
      recovery_procedures: '',
      owner: '',
    });
  };

  const getTypeIcon = (type) => {
    const icons = {
      domain: '🌐',
      social_media: '📱',
      design_system: '🎨',
      brand_asset: '🏷️',
    };
    return icons[type] || '🔧';
  };

  const getTypeColor = (type) => {
    const colors = {
      domain: 'bg-blue-100 text-blue-800',
      social_media: 'bg-pink-100 text-pink-800',
      design_system: 'bg-purple-100 text-purple-800',
      brand_asset: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (level) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
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
            <h1 className="text-3xl font-bold text-foreground">Infrastructure</h1>
            <p className="text-muted-foreground">Manage operational foundations and business continuity</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({
                name: '',
                infrastructure_type: 'website',
                description: '',
                risk_level: 'medium',
                replacement_cost: '',
                recovery_procedures: '',
                owner_name: '',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            <Plus size={20} /> Add Infrastructure
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Replacement Cost</p>
                <p className="text-2xl font-bold text-foreground"><CurrencyDisplay amount={getTotalReplacementCost()} /></p>
              </div>
              <Shield className="text-primary" size={40} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Critical Items</p>
                <p className="text-2xl font-bold text-red-600">{getCriticalCount()}</p>
              </div>
              <AlertTriangle className="text-red-500" size={40} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Items</p>
                <p className="text-2xl font-bold text-foreground">{infrastructure.length}</p>
              </div>
              <Globe className="text-accent" size={40} />
            </div>
          </div>
        </div>

        {/* Infrastructure List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Risk Level</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Replacement Cost</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Owner</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {infrastructure.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-muted-foreground">
                      No infrastructure items yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  infrastructure.map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                        <span>{getTypeIcon(item.infrastructure_type)}</span>
                        {item.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(item.infrastructure_type)}`}>
                          {item.infrastructure_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(item.risk_level)}`}>
                          {item.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        <CurrencyDisplay amount={item.replacement_cost || 0} />
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.owner_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.description || '—'}</td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <button 
                          onClick={() => handleEditInfra(item)}
                          className="p-1 hover:bg-muted rounded" title="Edit">
                          <Edit size={18} className="text-muted-foreground" />
                        </button>
                        <button 
                          onClick={() => handleDeleteInfra(item.id)}
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
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-foreground mb-4">{editingId ? 'Edit Infrastructure Item' : 'Add Infrastructure Item'}</h2>
              <form onSubmit={handleCreateInfra} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., jeton.ai domain"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Type *</label>
                  <select
                    value={form.infrastructure_type}
                    onChange={(e) => setForm({ ...form, infrastructure_type: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="website">Website</option>
                    <option value="domain">Domain</option>
                    <option value="social_media">Social Media</option>
                    <option value="design_system">Design System</option>
                    <option value="brand">Brand</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Risk Level</label>
                  <select
                    value={form.risk_level}
                    onChange={(e) => setForm({ ...form, risk_level: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Replacement Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.replacement_cost}
                    onChange={(e) => setForm({ ...form, replacement_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Owner</label>
                  <input
                    type="text"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., CTO"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Additional details..."
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
                    {editingId ? 'Update' : 'Add'}
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
