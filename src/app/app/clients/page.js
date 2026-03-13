'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Building2, ChevronRight, Handshake } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700', inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-orange-100 text-orange-700', churned: 'bg-red-100 text-red-700',
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', industry: '', payment_terms: 30 });
  const toast = useToast();

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      let url = '/api/clients';
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setClients(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const createClient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if ((await res.json()).success) { toast.success('Client created'); setShowForm(false); fetchClients(); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clients</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {showForm && (
        <form onSubmit={createClient} className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">New Client</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} placeholder="Company Name *" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} placeholder="Contact Name" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} placeholder="Industry" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
            <input type="number" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: parseInt(e.target.value)})} placeholder="Payment Terms (days)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      <form onSubmit={e => { e.preventDefault(); setLoading(true); fetchClients(); }} className="relative w-64">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-full bg-background text-foreground" />
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No clients yet. Convert prospects or add directly.</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {clients.map(c => (
            <Link key={c.id} href={`/app/clients/${c.id}`} className="flex items-center justify-between p-4 hover:bg-muted transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c.company_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.contact_name && <span>{c.contact_name}</span>}
                    {c.deal_count > 0 && <span className="ml-3"><Handshake className="w-3 h-3 inline" /> {c.deal_count} deals</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {parseFloat(c.total_deal_value) > 0 && (
                  <span className="text-sm font-medium text-foreground">{formatCurrency(c.total_deal_value)}</span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
