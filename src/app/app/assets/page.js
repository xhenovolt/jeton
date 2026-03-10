'use client';

import { useEffect, useState } from 'react';
import { Plus, Building2, Trash2, TrendingUp, Package, History, MapPin, Tag } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

function fmt(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

const ASSET_TYPES = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'software', label: 'Software / License' },
  { value: 'domain', label: 'Domain / Hosting' },
  { value: 'ip', label: 'Intellectual Property' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'other', label: 'Other' },
];

const CONDITION_OPTS = ['new', 'good', 'fair', 'poor', 'damaged'];

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [showHistorical, setShowHistorical] = useState(false);
  const [form, setForm] = useState({
    name: '', asset_type: 'equipment', cost: '', current_value: '', currency: 'UGX',
    acquisition_date: '', description: '', location: '', serial_number: '', condition: 'good',
    is_historical: false, account_deducted_from: '', notes: '',
  });

  useEffect(() => {
    fetchAssets();
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data); }).catch(() => {});
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetchWithAuth('/api/assets?limit=200');
      const json = await res.json();
      if (json.success) setAssets(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        cost: form.cost ? parseFloat(form.cost) : null,
        current_value: form.current_value ? parseFloat(form.current_value) : (form.cost ? parseFloat(form.cost) : null),
        account_deducted_from: form.account_deducted_from || null,
        acquisition_date: form.acquisition_date || null,
        serial_number: form.serial_number || null,
        location: form.location || null,
        description: form.description || null,
        notes: form.notes || null,
      };
      const res = await fetchWithAuth('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setAssets(prev => [json.data, ...prev]);
        setForm({ name: '', asset_type: 'equipment', cost: '', current_value: '', currency: 'UGX', acquisition_date: '', description: '', location: '', serial_number: '', condition: 'good', is_historical: false, account_deducted_from: '', notes: '' });
        setShowForm(false);
      } else {
        alert(json.error || 'Failed to save asset');
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this asset?')) return;
    try {
      await fetchWithAuth(`/api/assets?id=${id}`, { method: 'DELETE' });
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err) { console.error(err); }
  };

  const filtered = assets.filter(a => {
    if (!showHistorical && a.is_historical) return false;
    if (filterType && a.asset_type !== filterType) return false;
    return true;
  });

  const totalCost = filtered.reduce((s, a) => s + parseFloat(a.cost || a.value || 0), 0);
  const totalCurrent = filtered.reduce((s, a) => s + parseFloat(a.current_value || a.cost || a.value || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets & Infrastructure</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} assets · Current value: UGX {Math.round(totalCurrent).toLocaleString()}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Invested</p>
          <p className="text-2xl font-bold text-foreground mt-1">UGX {Math.round(totalCost).toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Value</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">UGX {Math.round(totalCurrent).toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Asset Count</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p>
          {assets.filter(a => a.is_historical).length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{assets.filter(a => a.is_historical).length} historical</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setFilterType('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterType ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
        {ASSET_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilterType(filterType === t.value ? '' : t.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === t.value ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{t.label}</button>
        ))}
        <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
          <input type="checkbox" checked={showHistorical} onChange={e => setShowHistorical(e.target.checked)} className="rounded" />
          <span className="text-xs text-muted-foreground">Show historical</span>
        </label>
      </div>

      {/* Add Asset Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Add Asset</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Asset Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HP Laptop, Printer, Desk" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Asset Type *</label>
              <select value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                <option value="UGX">UGX</option>
                <option value="USD">USD</option>
                <option value="KES">KES</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Purchase Cost</label>
              <input type="number" step="1" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Current Value</label>
              <input type="number" step="1" min="0" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} placeholder="Same as cost" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Acquisition Date</label>
              <input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                {CONDITION_OPTS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Office, Kampala" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Serial / Tag Number</label>
              <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Deduct from Account (creates ledger entry)</label>
            <select value={form.account_deducted_from} onChange={e => setForm(f => ({ ...f, account_deducted_from: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
              <option value="">— No deduction —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance, a.currency)})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description / Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional details..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_historical} onChange={e => setForm(f => ({ ...f, is_historical: e.target.checked }))} className="rounded" />
            <span className="text-sm text-muted-foreground">Historical acquisition (purchased before Jeton was set up)</span>
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save Asset'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {/* Assets List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No assets recorded</p>
          <p className="text-sm mt-1">Track laptops, equipment, vehicles, domains, IP, and infrastructure</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {filtered.map(a => {
            const typeInfo = ASSET_TYPES.find(t => t.value === a.asset_type) || { label: a.asset_type };
            return (
              <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-medium text-foreground">{a.name}</p>
                    <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{typeInfo.label}</span>
                    {a.is_historical && <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1"><History className="w-3 h-3" />Historical</span>}
                    {a.condition && <span className={`text-xs px-2 py-0.5 rounded-full ${a.condition === 'new' ? 'bg-emerald-50 text-emerald-700' : a.condition === 'good' ? 'bg-teal-50 text-teal-700' : 'bg-muted text-muted-foreground'}`}>{a.condition}</span>}
                  </div>
                  {(a.cost || a.value) && (
                    <div className="flex items-center gap-4 text-sm mt-1">
                      <span className="text-muted-foreground">Cost: <span className="font-semibold text-foreground">{fmt(a.cost || a.value, a.currency)}</span></span>
                      {a.current_value && parseFloat(a.current_value) !== parseFloat(a.cost || a.value) && (
                        <span className="text-muted-foreground">Current: <span className={`font-semibold ${parseFloat(a.current_value) >= parseFloat(a.cost || 0) ? 'text-emerald-600' : 'text-orange-500'}`}>{fmt(a.current_value, a.currency)}</span></span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {a.acquisition_date && <span>Acquired {new Date(a.acquisition_date).toLocaleDateString()}</span>}
                    {a.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                    {a.serial_number && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{a.serial_number}</span>}
                  </div>
                  {(a.notes || a.description) && <p className="text-xs text-muted-foreground mt-1">{a.notes || a.description}</p>}
                </div>
                <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition ml-2 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
