'use client';

import { useEffect, useState } from 'react';
import { Plus, Activity, Code, Bug, TestTube, Rocket, Users, Search, DollarSign, Zap, BarChart3 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const OPERATION_TYPES = [
  { value: 'coding', label: 'Coding', icon: Code, color: 'bg-blue-100 text-blue-700' },
  { value: 'debugging', label: 'Debugging', icon: Bug, color: 'bg-orange-100 text-orange-700' },
  { value: 'testing', label: 'Testing', icon: TestTube, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'deployment', label: 'Deployment', icon: Rocket, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'sales_meeting', label: 'Sales Meeting', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { value: 'prospecting', label: 'Prospecting', icon: Search, color: 'bg-pink-100 text-pink-700' },
  { value: 'follow_up', label: 'Follow-up', icon: Activity, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'payment_collection', label: 'Payment Collection', icon: DollarSign, color: 'bg-green-100 text-green-700' },
  { value: 'financial_allocation', label: 'Financial Allocation', icon: BarChart3, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'other', label: 'Other', icon: Zap, color: 'bg-muted text-muted-foreground' },
];

const TYPE_MAP = Object.fromEntries(OPERATION_TYPES.map(t => [t.value, t]));

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function OperationsPage() {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({
    operation_type: 'coding', description: '', related_system_id: '', related_deal_id: '', notes: '',
  });

  useEffect(() => {
    fetchOps();
    fetchWithAuth('/api/systems').then(r => r.json()).then(j => { if (j.success) setSystems(j.data); });
    fetchWithAuth('/api/deals').then(r => r.json()).then(j => { if (j.success) setDeals(j.data.slice(0, 30)); });
  }, []);

  const fetchOps = async (type = '') => {
    setLoading(true);
    try {
      const url = type ? `/api/operations?type=${type}&limit=100` : '/api/operations?limit=100';
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setOps(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleFilterChange = (type) => {
    setTypeFilter(type);
    fetchOps(type);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          related_system_id: form.related_system_id || null,
          related_deal_id: form.related_deal_id || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setOps(prev => [json.data, ...prev]);
        setForm({ operation_type: 'coding', description: '', related_system_id: '', related_deal_id: '', notes: '' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  // Count operations by type today
  const today = new Date().toDateString();
  const todayCount = ops.filter(o => new Date(o.created_at).toDateString() === today).length;
  const byType = OPERATION_TYPES.map(t => ({
    ...t,
    count: ops.filter(o => o.operation_type === t.value).length,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Founder Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ops.length} total logged · {todayCount} today
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Log Operation
        </button>
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {byType.slice(0, 5).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => handleFilterChange(typeFilter === t.value ? '' : t.value)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition text-left ${
                typeFilter === t.value
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border bg-card hover:border-blue-300'
              }`}
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">{t.count}</p>
                <p className="text-xs text-muted-foreground leading-tight">{t.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Log Operation Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Log Operation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
              <select
                value={form.operation_type}
                onChange={e => setForm(f => ({ ...f, operation_type: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
              >
                {OPERATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Related System</label>
              <select
                value={form.related_system_id}
                onChange={e => setForm(f => ({ ...f, related_system_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
              >
                <option value="">— None —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
            <textarea
              required
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What did you do?"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Related Deal</label>
            <select
              value={form.related_deal_id}
              onChange={e => setForm(f => ({ ...f, related_deal_id: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background"
            >
              <option value="">— None —</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.title} ({d.client_label})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Log Operation'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter buttons row */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleFilterChange('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!typeFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          All
        </button>
        {OPERATION_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => handleFilterChange(typeFilter === t.value ? '' : t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${typeFilter === t.value ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Operations Timeline */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : ops.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No operations logged yet</p>
          <p className="text-sm mt-1">Log every action — coding, sales meetings, payments, deployments</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {ops.map(op => {
            const type = TYPE_MAP[op.operation_type] || TYPE_MAP.other;
            const Icon = type.icon;
            return (
              <div key={op.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition">
                <div className={`p-2 rounded-lg shrink-0 ${type.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
                      {type.label}
                    </span>
                    {op.system_name && (
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {op.system_name}
                      </span>
                    )}
                    {op.deal_title && (
                      <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                        {op.deal_title}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1">{op.description}</p>
                  {op.notes && <p className="text-xs text-muted-foreground mt-0.5">{op.notes}</p>}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{timeAgo(op.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
