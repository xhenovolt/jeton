'use client';

import { useCallback, useEffect, useState } from 'react';
import { PiggyBank, Plus, X, Edit, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const CATEGORIES = ['office','software','marketing','travel','meals','equipment','professional_services','utilities','rent','insurance','taxes','payroll','other'];
const EMPTY_FORM = { name: '', amount: '', category: 'other', currency: 'UGX', start_date: '', end_date: '' };

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchBudgets = useCallback(async () => {
    setLoadError(null);
    const res = await api.get('/api/budgets', { silent: true });
    if (res.ok) setBudgets(Array.isArray(res.data) ? res.data : []);
    else setLoadError(res.error || 'Failed to load budgets');
    setLoading(false);
  }, []);

  // Initial load. This call was missing entirely, so the page sat on its
  // spinner forever and only fetched after a create or delete.
  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (form.end_date <= form.start_date) {
      toast.error('Period end must be after period start');
      return;
    }
    setSaving(true);
    const body = {
      name: form.name,
      amount: parseFloat(form.amount),
      category: form.category || 'other',
      currency: form.currency || 'UGX',
      start_date: form.start_date,
      end_date: form.end_date,
      ...(editId ? {} : { period: 'custom' }),
    };
    const res = editId
      ? await api.put(`/api/budgets/${editId}`, body, { successMessage: 'Budget updated' })
      : await api.post('/api/budgets', body, { successMessage: 'Budget created' });
    setSaving(false);
    if (res.ok) { setShowForm(false); resetForm(); fetchBudgets(); }
  };

  const startEdit = (b) => {
    setForm({
      name: b.name,
      amount: (b.amount ?? b.budgeted)?.toString() || '',
      category: b.category || 'other',
      currency: b.currency || 'UGX',
      start_date: b.start_date?.split('T')[0] || '',
      end_date: b.end_date?.split('T')[0] || '',
    });
    setEditId(b.id);
    setShowForm(true);
  };

  const deleteBudget = async (b) => {
    if (!await confirmDelete(b.name || 'budget')) return;
    const res = await api.delete(`/api/budgets/${b.id}`, { successMessage: 'Budget deleted' });
    if (res.ok) fetchBudgets();
  };

  const input = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">{loading ? 'Loading…' : `${budgets.length} budget${budgets.length !== 1 ? 's' : ''}`}</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'New Budget'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit' : 'Create'} Budget</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={input} placeholder="e.g. Q1 Marketing" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Limit Amount *</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                  {['UGX', 'USD', 'EUR', 'GBP', 'KES'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className={input} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required className={input}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Period Start *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required className={input} />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Period End *</label>
              <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required className={input} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update Budget' : 'Create Budget'}</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button onClick={() => { setLoading(true); fetchBudgets(); }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No budgets yet. Set spending limits to track your expenses.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(b => {
            const limit = parseFloat(b.amount ?? b.budgeted ?? 0);
            const spent = parseFloat(b.spent || 0);
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const overBudget = pct > 100;
            const nearLimit = pct >= parseFloat(b.alert_threshold ?? 80);
            return (
              <div key={b.id} className="bg-card rounded-xl border p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <PiggyBank className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground truncate">{b.name}</span>
                    {b.category && <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground capitalize">{b.category.replace(/_/g,' ')}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(b)} title="Edit" className="p-1 hover:bg-muted rounded"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => deleteBudget(b)} title="Delete" className="p-1 hover:bg-red-50 rounded dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" /></button>
                  </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <span className={`text-lg font-bold ${overBudget ? 'text-red-600' : 'text-foreground'}`}>{formatCurrency(spent, b.currency)}</span>
                    <span className="text-sm text-muted-foreground"> / {formatCurrency(limit, b.currency)}</span>
                  </div>
                  <span className={`text-sm font-medium ${overBudget ? 'text-red-600' : nearLimit ? 'text-orange-600' : 'text-emerald-600'}`}>{pct}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : nearLimit ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {b.start_date && b.end_date ? `${new Date(b.start_date).toLocaleDateString()} — ${new Date(b.end_date).toLocaleDateString()}` : 'No period set'}
                  {b.expense_count > 0 && ` · ${b.expense_count} expense${b.expense_count !== 1 ? 's' : ''}`}
                  {b.is_active === false && ' · inactive'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
