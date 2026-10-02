'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Plus, PieChart, TrendingUp, AlertCircle, X, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const CATEGORY_COLORS = {
  emergency_fund: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', bar: 'bg-red-500' },
  operations: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', bar: 'bg-blue-500' },
  reinvestment: { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' },
  founder_compensation: { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', bar: 'bg-purple-500' },
};
const CATEGORY_LABELS = { emergency_fund: 'Emergency Fund', operations: 'Operations', reinvestment: 'Reinvestment', founder_compensation: 'Founder Comp' };

/**
 * Coerce an API field that must be a list into a list.
 *
 * This is deliberately NOT a silent `|| []`. If the server ever changes shape
 * again, the console names the exact field so the contract break is visible
 * instead of surfacing later as ".map is not a function" in a minified bundle.
 */
function asArray(value, fieldName) {
  if (Array.isArray(value)) return value;
  if (value !== undefined && value !== null) {
    console.error(
      `[FinancialIntelligence] expected ${fieldName} to be an array, got ${
        Object.prototype.toString.call(value)}. Rendering empty.`, value);
  }
  return [];
}

export default function FinancialIntelligencePage() {
  const [rules, setRules] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [revenueEvents, setRevenueEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [revForm, setRevForm] = useState({ source_type: 'deal_payment', source_reference: '', amount: '', description: '' });
  const toast = useToast();

  const fetchData = async () => {
    setLoadError('');
    try {
      const [allocRes, revRes] = await Promise.all([
        fetchWithAuth('/api/capital-allocation').then(r => r.json ? r.json() : r),
        fetchWithAuth('/api/revenue-events').then(r => r.json ? r.json() : r),
      ]);

      // GET /api/capital-allocation responds with
      //   { success, data: { rules[], allocations[], total_revenue } }
      // This used to read allocRes.data straight into `rules`, so `rules` was
      // set to the wrapper OBJECT. `|| []` could not catch it because an object
      // is truthy, and the next render hit rules.map() -> "e.map is not a
      // function". `summaries` and `total_revenue` were likewise read one level
      // too high and silently resolved to [] and 0, so the page never showed
      // allocation totals even when it did render.
      if (allocRes?.success) {
        const payload = allocRes.data ?? {};
        setRules(asArray(payload.rules, 'capital-allocation.data.rules'));
        setSummaries(asArray(payload.allocations, 'capital-allocation.data.allocations'));
        setTotalRevenue(Number.parseFloat(payload.total_revenue) || 0);
      } else {
        setLoadError(allocRes?.error || 'Could not load capital allocation policy.');
      }

      // GET /api/revenue-events responds with { success, data: [...] }
      if (revRes?.success) {
        setRevenueEvents(asArray(revRes.data, 'revenue-events.data'));
      } else {
        setLoadError(prev => prev || revRes?.error || 'Could not load revenue events.');
      }
    } catch (err) {
      console.error('[FinancialIntelligence] load failed:', err);
      setLoadError('Could not reach the server. Check your connection and retry.');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const submitRevenue = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/revenue-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...revForm, amount: parseFloat(revForm.amount) }) });
      const json = res.json ? await res.json() : res;
      if (json.success) {
        toast.success('Revenue event recorded');
        setShowRevenueForm(false);
        setRevForm({ source_type: 'deal_payment', source_reference: '', amount: '', description: '' });
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const formatMoney = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financial Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">Capital allocation, revenue tracking, and budget management</p>
      </div>

      {/* A failed load used to render as a silently empty page. Say what broke
          and offer a way out. */}
      {loadError && (
        <div className="flex items-start justify-between gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{loadError}</span>
          </div>
          <button onClick={() => { setLoading(true); fetchData(); }}
            className="shrink-0 underline hover:no-underline font-medium">Retry</button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="w-4 h-4" /> Total Revenue</div>
          <div className="text-2xl font-bold text-foreground mt-1">{formatMoney(totalRevenue)}</div>
        </div>
        {summaries.map(s => {
          const c = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.operations;
          return (
            <div key={s.category} className={`rounded-xl border p-4 ${c.bg}`}>
              <div className={`text-xs ${c.text}`}>{CATEGORY_LABELS[s.category] || s.category}</div>
              <div className={`text-2xl font-bold ${c.text} mt-1`}>{formatMoney(s.total_allocated)}</div>
              <div className="text-xs opacity-70 mt-1">This Month: {formatMoney(s.this_month)}</div>
            </div>
          );
        })}
      </div>

      {/* Allocation Rules */}
      <div className="bg-card rounded-xl border p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><PieChart className="w-5 h-5" /> Capital Allocation Policy</h2>
        {rules.length === 0 && !loadError && (
          <p className="text-sm text-muted-foreground">
            No allocation rules defined yet. Revenue will not be split across categories until you add one.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rules.map(rule => {
            const c = CATEGORY_COLORS[rule.category] || CATEGORY_COLORS.operations;
            return (
              <div key={rule.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${c.text}`}>{CATEGORY_LABELS[rule.category] || rule.category}</span>
                  <span className="text-lg font-bold">{parseFloat(rule.percentage)}%</span>
                </div>
                {rule.description && <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${c.bar}`} style={{ width: `${parseFloat(rule.percentage)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Total: {rules.reduce((sum, r) => sum + parseFloat(r.percentage), 0).toFixed(1)}% allocated</p>
      </div>

      {/* Revenue Events */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Revenue Events</h2>
          <button onClick={() => setShowRevenueForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><Plus className="w-4 h-4" /> Record Revenue</button>
        </div>

        {showRevenueForm && (
          <form onSubmit={submitRevenue} className="border rounded-lg p-4 mb-4 bg-muted/30 space-y-3">
            <div className="flex justify-between items-center"><h3 className="text-sm font-medium">Record Revenue Event</h3><button type="button" onClick={() => setShowRevenueForm(false)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Source Type</label><select value={revForm.source_type} onChange={e => setRevForm(f => ({ ...f, source_type: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background">{['deal_payment', 'subscription', 'service', 'other'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="text-xs text-muted-foreground">Amount *</label><input type="number" step="0.01" value={revForm.amount} onChange={e => setRevForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground">Reference</label><input value={revForm.source_reference} onChange={e => setRevForm(f => ({ ...f, source_reference: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" placeholder="Deal name, invoice number..." /></div>
              <div><label className="text-xs text-muted-foreground">Description</label><input value={revForm.description} onChange={e => setRevForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Record & Auto-Allocate</button>
          </form>
        )}

        <div className="divide-y max-h-[400px] overflow-y-auto">
          {revenueEvents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground"><DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No revenue events recorded yet</p></div>
          ) : revenueEvents.map(ev => (
            <div key={ev.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-foreground">{formatMoney(ev.amount)}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-muted-foreground">{ev.source_type.replace(/_/g, ' ')}</span>
                </div>
                {ev.description && <p className="text-sm text-muted-foreground mt-0.5 ml-6">{ev.description}</p>}
                {ev.allocations && ev.allocations.length > 0 && (
                  <div className="ml-6 mt-1 flex gap-2 flex-wrap">
                    {ev.allocations.filter(a => a !== null).map((a, i) => {
                      const c = CATEGORY_COLORS[a.category] || CATEGORY_COLORS.operations;
                      return <span key={i} className={`text-xs px-2 py-0.5 rounded ${c.bg} ${c.text}`}>{CATEGORY_LABELS[a.category] || a.category}: {formatMoney(a.amount)}</span>;
                    })}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(ev.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
