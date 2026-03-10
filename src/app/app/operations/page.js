'use client';

import { useEffect, useState } from 'react';
import { Plus, Activity, Truck, Search, Wifi, Megaphone, Wrench, DollarSign, ChevronDown } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const CATEGORIES = [
  { value: 'transport', label: 'Transport', icon: Truck, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'prospecting', label: 'Prospecting', icon: Search, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'internet_data', label: 'Internet/Data', icon: Wifi, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  { value: 'equipment', label: 'Equipment', icon: Wrench, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'salary', label: 'Salary', icon: DollarSign, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'other', label: 'Other', icon: Activity, color: 'bg-muted text-muted-foreground' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fmt(amount, currency) {
  return `${currency || 'UGX'} ${Math.round(parseFloat(amount || 0)).toLocaleString()}`;
}

export default function OperationsPage() {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [form, setForm] = useState({
    title: '', category: 'other', expense_type: 'operational', amount: '', currency: 'UGX',
    account_id: '', operation_date: new Date().toISOString().split('T')[0],
    vendor: '', related_system_id: '', description: '', notes: '',
  });

  useEffect(() => {
    fetchOps();
    fetchWithAuth('/api/systems').then(r => r.json()).then(j => { if (j.success) setSystems(j.data); }).catch(() => {});
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data); }).catch(() => {});
  }, []);

  const fetchOps = async (cat = '') => {
    setLoading(true);
    try {
      const url = cat ? `/api/operations?category=${cat}&limit=200` : '/api/operations?limit=200';
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setOps(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleFilterChange = (cat) => {
    setCatFilter(cat);
    fetchOps(cat);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        amount: form.amount ? parseFloat(form.amount) : null,
        account_id: form.account_id || null,
        related_system_id: form.related_system_id || null,
        vendor: form.vendor || null,
        notes: form.notes || null,
        description: form.description || null,
      };
      const res = await fetchWithAuth('/api/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setOps(prev => [json.data, ...prev]);
        setForm({ title: '', category: 'other', expense_type: 'operational', amount: '', currency: 'UGX', account_id: '', operation_date: new Date().toISOString().split('T')[0], vendor: '', related_system_id: '', description: '', notes: '' });
        setShowForm(false);
      } else {
        alert(json.error || 'Failed to log operation');
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  // Stats
  const today = new Date().toDateString();
  const todayOps = ops.filter(o => new Date(o.created_at || o.operation_date).toDateString() === today);
  const totalSpent = ops.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  const byCategory = CATEGORIES.map(c => ({ ...c, count: ops.filter(o => (o.category || o.operation_type) === c.value).length }));
  const monthOps = ops.filter(o => {
    const d = new Date(o.operation_date || o.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthSpent = monthOps.reduce((s, o) => s + parseFloat(o.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Founder Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ops.length} logged · {todayOps.length} today · UGX {Math.round(totalSpent).toLocaleString()} total
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Log Operation
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-xl font-bold text-foreground mt-1">{todayOps.length}</p>
          <p className="text-xs text-muted-foreground">operations</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">This Month (Spent)</p>
          <p className="text-xl font-bold text-orange-600 mt-1">UGX {Math.round(monthSpent).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{monthOps.length} ops</p>
        </div>
        {byCategory.slice(0, 2).map(c => {
          const Icon = c.icon;
          return (
            <div key={c.value} className={`rounded-xl border border-border p-4 ${c.color.split(' ').find(cl => cl.startsWith('bg-'))?.replace('bg-', 'bg-') || ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <p className="text-xs font-medium">{c.label}</p>
              </div>
              <p className="text-xl font-bold">{c.count}</p>
            </div>
          );
        })}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => handleFilterChange('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!catFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => handleFilterChange(catFilter === c.value ? '' : c.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${catFilter === c.value ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{c.label}</button>
        ))}
      </div>

      {/* Log Operation Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Log Operation / Expense</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Taxi to Nakawa client" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input type="date" value={form.operation_date} onChange={e => setForm(f => ({ ...f, operation_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
              <div className="flex gap-1">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-16 px-1 py-2 border border-border rounded-lg bg-background text-foreground text-xs [&>option]:bg-background">
                  <option value="UGX">UGX</option>
                  <option value="USD">USD</option>
                  <option value="KES">KES</option>
                </select>
                <input type="number" step="1" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Pay from Account</label>
              <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                <option value="">— Cash/untracked —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance, a.currency)})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor / Payee</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Boda rider, MTN, Airtel" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Related System</label>
              <select value={form.related_system_id} onChange={e => setForm(f => ({ ...f, related_system_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                <option value="">— None —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional context..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition">{saving ? 'Saving…' : 'Log Operation'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {/* Operations Timeline */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : ops.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No operations logged yet</p>
          <p className="text-sm mt-1">Track transport costs, prospecting trips, internet data purchases, marketing, and more</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {ops.map(op => {
            const cat = CAT_MAP[op.category || op.operation_type] || CAT_MAP.other;
            const Icon = cat.icon;
            return (
              <div key={op.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition">
                <div className={`p-2 rounded-lg shrink-0 ${cat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground text-sm">{op.title || op.description}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                    {op.system_name && <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{op.system_name}</span>}
                  </div>
                  {op.title && op.description && op.description !== op.title && <p className="text-xs text-muted-foreground mt-0.5">{op.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {op.amount && parseFloat(op.amount) > 0 && <span className="text-orange-600 font-semibold">{fmt(op.amount, op.currency)}</span>}
                    {op.vendor && <span>→ {op.vendor}</span>}
                    {op.account_name && <span>from {op.account_name}</span>}
                    {op.notes && <span>· {op.notes}</span>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                  <p>{timeAgo(op.operation_date || op.created_at)}</p>
                  {op.operation_date && op.operation_date !== (op.created_at || '').split('T')[0] && (
                    <p>{new Date(op.operation_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
