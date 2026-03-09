'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Filter, ChevronRight, Mail, Phone, MapPin } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import Link from 'next/link';

const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'dormant'];
const STAGE_COLORS = {
  new: 'bg-muted text-foreground', contacted: 'bg-blue-100 text-blue-700', qualified: 'bg-cyan-100 text-cyan-700',
  proposal: 'bg-purple-100 text-purple-700', negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-emerald-100 text-emerald-700', lost: 'bg-red-100 text-red-700', dormant: 'bg-muted text-muted-foreground',
};

export default function ProspectsPage() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', source: '', stage: 'new', priority: 'medium', estimated_value: '', notes: '' });

  useEffect(() => { fetchProspects(); }, [stageFilter]);

  const fetchProspects = async () => {
    try {
      let url = '/api/prospects?limit=100';
      if (stageFilter) url += `&stage=${stageFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setProspects(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchProspects();
  };

  const createProspect = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/prospects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null }),
      });
      const json = await res.json();
      if (json.success) { setShowForm(false); setForm({ company_name: '', contact_name: '', email: '', phone: '', source: '', stage: 'new', priority: 'medium', estimated_value: '', notes: '' }); fetchProspects(); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">{prospects.length} total prospects</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Prospect
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={createProspect} className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">New Prospect</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} placeholder="Company Name *" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} placeholder="Contact Name" className="border rounded-lg px-3 py-2 text-sm" />
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone" className="border rounded-lg px-3 py-2 text-sm" />
            <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Source</option>
              {['referral','cold_outreach','inbound','event','social_media','website','partner','other'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="border rounded-lg px-3 py-2 text-sm">
              {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="number" value={form.estimated_value} onChange={e => setForm({...form, estimated_value: e.target.value})} placeholder="Estimated Value ($)" className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes" className="border rounded-lg px-3 py-2 text-sm w-full" rows={2} />
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prospects..." className="border rounded-lg pl-9 pr-3 py-2 text-sm w-64" />
          </div>
        </form>
        <div className="flex gap-1">
          <button onClick={() => setStageFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!stageFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-gray-200'}`}>All</button>
          {STAGES.filter(s => s !== 'won' && s !== 'lost').map(s => (
            <button key={s} onClick={() => setStageFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${stageFilter === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-gray-200'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Prospect List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No prospects found</p>
          <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm mt-2 hover:underline">Add your first prospect →</button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {prospects.map(p => (
            <Link key={p.id} href={`/app/prospects/${p.id}`} className="flex items-center justify-between p-4 hover:bg-muted transition">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground">{p.company_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[p.stage] || 'bg-muted'}`}>{p.stage}</span>
                  {p.priority === 'urgent' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Urgent</span>}
                  {p.priority === 'high' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">High</span>}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  {p.contact_name && <span>{p.contact_name}</span>}
                  {p.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>}
                  {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                  {p.followup_count > 0 && <span>{p.followup_count} follow-ups</span>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {p.estimated_value && <span className="text-sm font-medium text-foreground">{formatCurrency(p.estimated_value)}</span>}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
