'use client';

import { useEffect, useState } from 'react';
import { Plus, Package, X, Monitor, Wrench, HardDrive, Pencil, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const CATEGORY_INFO = {
  business_tool: { label: 'Business Tools', icon: Wrench, color: 'bg-yellow-100 text-yellow-700', examples: 'T-shirts, suits, shoes, presentation materials' },
  infrastructure: { label: 'Infrastructure', icon: Monitor, color: 'bg-blue-100 text-blue-700', examples: 'Domains, hosting, servers, websites' },
  hardware: { label: 'Hardware Assets', icon: HardDrive, color: 'bg-purple-100 text-purple-700', examples: 'Laptops, phones, fingerprint machines' },
};
const STATUS_COLORS = { active: 'bg-emerald-100 text-emerald-700', inactive: 'bg-muted text-muted-foreground', retired: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700', maintenance: 'bg-orange-100 text-orange-700' };

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'business_tool', description: '', cost: '', currency: 'UGX', provider: '', renewal_date: '', serial_number: '', assigned_to: '', acquisition_date: '', status: 'active', notes: '', usage_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth('/api/resources').then(r => r.json()).then(j => { if (j.success) setResources(j.data || []); }).catch(console.error).finally(() => setLoading(false));
    fetchWithAuth('/api/staff').then(r => r.json()).then(j => { if (j.success) setStaff(j.data || []); }).catch(() => {});
  }, []);

  const fetchResources = () => {
    fetchWithAuth('/api/resources').then(r => r.json()).then(j => { if (j.success) setResources(j.data || []); }).catch(console.error);
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form, cost: form.cost ? parseFloat(form.cost) : 0 };
      if (!body.assigned_to) delete body.assigned_to;
      if (!body.renewal_date) delete body.renewal_date;
      if (!body.acquisition_date) delete body.acquisition_date;
      const res = await fetchWithAuth('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) {
        setShowForm(false);
        setForm({ name: '', category: 'business_tool', description: '', cost: '', currency: 'UGX', provider: '', renewal_date: '', serial_number: '', assigned_to: '', acquisition_date: '', status: 'active', notes: '', usage_notes: '' });
        fetchResources();
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const deleteResource = async (id) => {
    if (!confirm('Delete this resource?')) return;
    await fetchWithAuth(`/api/resources?id=${id}`, { method: 'DELETE' });
    fetchResources();
  };

  const filtered = filter ? resources.filter(r => r.category === filter) : resources;
  const totalCost = filtered.reduce((s, r) => s + parseFloat(r.cost || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resources</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} items · UGX {Math.round(totalCost).toLocaleString()} total value</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'Add Resource'}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!filter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All ({resources.length})</button>
        {Object.entries(CATEGORY_INFO).map(([key, info]) => {
          const count = resources.filter(r => r.category === key).length;
          return <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === key ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{info.label} ({count})</button>;
        })}
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Add Resource</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="e.g. MacBook Pro M2" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {Object.entries(CATEGORY_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">e.g. {CATEGORY_INFO[form.category]?.examples}</p>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Cost</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
                  <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option>
                </select>
                <input type="number" step="1" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Acquisition Date</label>
              <input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            {form.category === 'hardware' && (
              <>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Serial Number</label>
                  <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Assigned To</label>
                  <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                    <option value="">Unassigned</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {form.category === 'infrastructure' && (
              <>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Provider</label>
                  <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="e.g. Namecheap, Vercel" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Renewal Date</label>
                  <input type="date" value={form.renewal_date} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
                </div>
              </>
            )}
            {form.category === 'business_tool' && (
              <div className="md:col-span-2">
                <label className="block text-sm text-muted-foreground mb-1">Usage Notes</label>
                <input value={form.usage_notes} onChange={e => setForm(f => ({ ...f, usage_notes: e.target.value }))} placeholder="How/when is this used?" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Resource'}</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No resources found. Add your first resource.</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y divide-border">
          {filtered.map(r => {
            const info = CATEGORY_INFO[r.category] || CATEGORY_INFO.business_tool;
            const Icon = info.icon;
            return (
              <div key={r.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${info.color}`}><Icon className="w-4 h-4" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{r.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-muted text-foreground'}`}>{r.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {info.label}
                      {r.provider && ` · ${r.provider}`}
                      {r.serial_number && ` · S/N: ${r.serial_number}`}
                      {r.assigned_to_name && ` · Assigned: ${r.assigned_to_name}`}
                      {r.renewal_date && ` · Renews: ${new Date(r.renewal_date).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{r.currency} {Math.round(parseFloat(r.cost || 0)).toLocaleString()}</div>
                    {r.acquisition_date && <div className="text-xs text-muted-foreground">{new Date(r.acquisition_date).toLocaleDateString()}</div>}
                  </div>
                  <button onClick={() => deleteResource(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
