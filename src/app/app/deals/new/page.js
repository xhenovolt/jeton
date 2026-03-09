'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';

export default function NewDealPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '', offering_id: '', title: '', description: '', total_amount: '', status: 'draft', start_date: '', end_date: ''
  });

  useEffect(() => {
    fetchWithAuth('/api/clients').then(r => r.json()).then(j => { if (j.success) setClients(j.data); }).catch(() => {});
    fetchWithAuth('/api/offerings').then(r => r.json()).then(j => { if (j.success) setOfferings(j.data); }).catch(() => {});
  }, []);

  const handleOfferingSelect = (offeringId) => {
    setForm(f => ({ ...f, offering_id: offeringId }));
    if (offeringId) {
      const o = offerings.find(x => x.id === offeringId);
      if (o && o.default_price) setForm(f => ({ ...f, total_amount: o.default_price.toString(), title: f.title || o.name }));
    }
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form, total_amount: parseFloat(form.total_amount) };
      if (!body.offering_id) delete body.offering_id;
      if (!body.start_date) delete body.start_date;
      if (!body.end_date) delete body.end_date;
      if (!body.description) delete body.description;
      const res = await fetchWithAuth('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) router.push(`/app/deals/${json.data.id}`);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/app/deals')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-gray-900">New Deal</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg">
            <option value="">Select a client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Offering (optional)</label>
          <select value={form.offering_id} onChange={e => handleOfferingSelect(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
            <option value="">None</option>
            {offerings.map(o => <option key={o.id} value={o.id}>{o.name} {o.default_price && `- ${formatCurrency(o.default_price)}`}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Website Redesign for Acme" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg" placeholder="Deal details..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount *</label>
            <input type="number" step="0.01" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
              {['draft','sent','accepted','in_progress'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create Deal'}
          </button>
        </div>
      </form>
    </div>
  );
}
