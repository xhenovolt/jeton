'use client';

import { useEffect, useState } from 'react';
import { Plus, Building2, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

function formatCurr(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', value: '', currency: 'UGX', description: '' });

  useEffect(() => { fetchAssets(); }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetchWithAuth('/api/assets');
      const json = await res.json();
      if (json.success) setAssets(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, value: form.value ? parseFloat(form.value) : null };
      const res = await fetchWithAuth('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setAssets(prev => [json.data, ...prev]);
        setForm({ name: '', value: '', currency: 'UGX', description: '' });
        setShowForm(false);
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

  const total = assets.reduce((s, a) => s + parseFloat(a.value || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {assets.length} assets · Total: UGX {Math.round(total).toLocaleString()}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      {/* Total Card */}
      <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Asset Value</p>
          <p className="text-2xl font-bold text-foreground">UGX {Math.round(total).toLocaleString()}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Add Asset</h2>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Asset name *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          <div className="flex gap-3">
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
              <option value="UGX">UGX</option>
              <option value="USD">USD</option>
            </select>
            <input type="number" step="1" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="Value (optional)" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No assets recorded</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {assets.map(a => (
            <div key={a.id} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-foreground">{a.name}</p>
                {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                {a.value && <p className="text-sm font-semibold text-emerald-600 mt-1">{formatCurr(a.value, a.currency)}</p>}
              </div>
              <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition ml-4">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
