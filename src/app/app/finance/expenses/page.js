'use client';

import { useEffect, useState } from 'react';
import { Plus, Receipt, X, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

const CATEGORIES = ['office','software','marketing','travel','meals','equipment','professional_services','utilities','rent','insurance','taxes','payroll','other'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ account_id: '', amount: '', category: 'other', description: '', vendor: '', budget_id: '' });
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState('newest');
  const [loadError, setLoadError] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data); }).catch(() => {});
    fetchWithAuth('/api/budgets').then(r => r.json()).then(j => { if (j.success) setBudgets(j.data); }).catch(() => {});
  }, []);

  // Sorting is done by the server, not in the browser: the list is ordered by
  // columns the client does not necessarily hold, and sorting a page's worth of
  // rows locally would reorder only what happens to be loaded.
  useEffect(() => { fetchExpenses(); }, [sort]);

  const fetchExpenses = async () => {
    setLoadError('');
    try {
      const res = await fetchWithAuth(`/api/expenses?sort=${encodeURIComponent(sort)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.success === false) {
        setLoadError(j.error || `Could not load expenses (HTTP ${res.status}).`);
        return;
      }
      setExpenses(Array.isArray(j.data) ? j.data : []);
    } catch (err) {
      console.error('[Expenses] load failed:', err);
      setLoadError('Could not reach the server.');
    } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form, amount: parseFloat(form.amount) };
      if (!body.budget_id) delete body.budget_id;
      if (!body.vendor) delete body.vendor;
      const res = await fetchWithAuth('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) { toast.success('Expense recorded'); setShowForm(false); setForm({ account_id: '', amount: '', category: 'other', description: '', vendor: '', budget_id: '' }); fetchExpenses(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const deleteExpense = async (id) => {
    if (!await confirmDelete('expense')) return;
    try { await fetchWithAuth(`/api/expenses/${id}`, { method: 'DELETE' }); toast.success('Expense deleted'); fetchExpenses(); } catch { toast.error('Failed to delete'); }
  };

  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">{expenses.length} expenses &middot; {formatCurrency(totalExpenses)} total</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">Record Expense</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Account *</label>
              <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Vendor</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="e.g. AWS, Figma" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Description *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="What was this expense for?" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Budget (optional)</label>
              <select value={form.budget_id} onChange={e => setForm(f => ({ ...f, budget_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">None</option>
                {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">{saving ? 'Recording...' : 'Record Expense'}</button>
        </form>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <span>{loadError}</span>
          <button onClick={() => { setLoading(true); fetchExpenses(); }}
            className="underline hover:no-underline font-medium shrink-0">Retry</button>
        </div>
      )}

      {/* Sort runs on the server so it applies to the whole list, not just the
          rows already loaded. Default is newest first. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${expenses.length} expense${expenses.length === 1 ? '' : 's'}`}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select value={sort} onChange={e => { setLoading(true); setSort(e.target.value); }}
            className="px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest_amount">Highest amount</option>
            <option value="lowest_amount">Lowest amount</option>
            <option value="category">Category</option>
            <option value="account">Account</option>
            <option value="vendor">Vendor</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : loadError ? null : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No expenses recorded yet</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {expenses.map(e => (
            <div key={e.id} className="flex items-center justify-between p-4 hover:bg-muted transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg"><Receipt className="w-4 h-4 text-red-600" /></div>
                <div>
                  <div className="text-sm font-medium text-foreground">{e.description}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize">{e.category?.replace(/_/g, ' ')}</span>
                    {e.vendor && <span>{e.vendor}</span>}
                    {e.account_name && <span>{e.account_name}</span>}
                    <span>{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-red-600">-{formatCurrency(e.amount)}</span>
                <button onClick={() => deleteExpense(e.id)} className="p-1 hover:bg-red-50 rounded dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
