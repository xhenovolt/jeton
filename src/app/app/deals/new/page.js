'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Monitor, Users } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

export default function NewDealPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSystemId = searchParams.get('system_id');

  const [clients, setClients] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [systems, setSystems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [clientMode, setClientMode] = useState('select');
  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    system_id: prefillSystemId || '',
    offering_id: '',
    title: '',
    description: '',
    total_amount: '',
    currency: 'UGX',
    status: 'draft',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    fetchWithAuth('/api/clients').then(r => r.json()).then(j => { if (j.success) setClients(j.data); }).catch(() => {});
    fetchWithAuth('/api/offerings').then(r => r.json()).then(j => { if (j.success) setOfferings(j.data); }).catch(() => {});
    fetchWithAuth('/api/systems').then(r => r.json()).then(j => { if (j.success) setSystems(j.data); }).catch(() => {});
  }, []);

  const handleOfferingSelect = (offeringId) => {
    setForm(f => ({ ...f, offering_id: offeringId }));
    if (offeringId) {
      const o = offerings.find(x => x.id === offeringId);
      if (o && o.default_price) setForm(f => ({ ...f, total_amount: o.default_price.toString(), title: f.title || o.name }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, total_amount: parseFloat(form.total_amount) };
      if (clientMode === 'select') { delete body.client_name; } else { delete body.client_id; }
      if (!body.offering_id) delete body.offering_id;
      if (!body.system_id) delete body.system_id;
      if (!body.start_date) delete body.start_date;
      if (!body.end_date) delete body.end_date;
      if (!body.description) delete body.description;
      const res = await fetchWithAuth('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) router.push('/app/deals');
      else alert(json.error || 'Failed to create deal');
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/app/deals')} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Deal</h1>
          <p className="text-sm text-muted-foreground">Record a licensing sale or service deal</p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-card rounded-xl border border-border p-6 space-y-5">

        {/* System (optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            <Monitor className="w-4 h-4 inline mr-1" />System (optional)
          </label>
          <select
            value={form.system_id}
            onChange={e => setForm(f => ({ ...f, system_id: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background"
          >
            <option value="">No system (service deal)</option>
            {systems.map(s => (
              <option key={s.id} value={s.id}>{s.version ? s.name + ' v' + s.version : s.name}</option>
            ))}
          </select>
          {form.system_id && (
            <p className="text-xs text-blue-600 mt-1">This deal will appear in the system's sales history</p>
          )}
        </div>

        {/* Client */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-foreground">
              <Users className="w-4 h-4 inline mr-1" />Client *
            </label>
            <button
              type="button"
              onClick={() => setClientMode(m => m === 'select' ? 'text' : 'select')}
              className="text-xs text-blue-600 hover:underline"
            >
              {clientMode === 'select' ? 'Enter name manually' : 'Choose from client list'}
            </button>
          </div>
          {clientMode === 'select' ? (
            <select
              value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background"
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>
              ))}
            </select>
          ) : (
            <input
              value={form.client_name}
              onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              required
              placeholder="e.g. Kampala Logistics Ltd"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          )}
        </div>

        {/* Offering (optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Offering (optional)</label>
          <select
            value={form.offering_id}
            onChange={e => handleOfferingSelect(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background"
          >
            <option value="">None</option>
            {offerings.map(o => (
              <option key={o.id} value={o.id}>
                {o.default_price ? o.name + ' — ' + Number(o.default_price).toLocaleString() : o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Deal Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            placeholder="e.g. Drais License — Kampala Logistics"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
            placeholder="Deal terms, scope, or context..."
          />
        </div>

        {/* Amount + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Deal Value *</label>
            <div className="flex gap-2">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
              >
                <option value="UGX">UGX</option>
                <option value="USD">USD</option>
                <option value="KES">KES</option>
              </select>
              <input
                type="number"
                step="1"
                min="0"
                value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                required
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background"
            >
              <option value="draft">Draft</option>
              <option value="negotiation">Negotiation</option>
              <option value="accepted">Accepted</option>
              <option value="payment_pending">Payment Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Closing / Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create Deal'}
          </button>
        </div>
      </form>
    </div>
  );
}
