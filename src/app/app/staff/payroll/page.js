'use client';

/**
 * /app/staff/payroll — Payouts & employee accounts.
 *
 * Replaces the old /app/hr page, which never rendered (it referenced an
 * undefined `styles` object) and guessed which API response was which from
 * the shape of data[0]. The staff directory lives on /app/staff.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Wallet, Receipt } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { PayoutModal } from '@/components/modals/PayoutModal';

const STATUS_TONE = {
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  active:    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  processed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  pending:   'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  suspended: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || 'bg-red-500/10 text-red-700 dark:text-red-400';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${tone}`}>{status || '—'}</span>;
}

function money(currency, amount) {
  const n = parseFloat(amount);
  return `${currency || 'UGX'} ${Number.isFinite(n) ? n.toLocaleString() : '0'}`;
}

const TABS = [
  { id: 'payouts',  label: 'Payouts',           icon: Receipt },
  { id: 'accounts', label: 'Employee Accounts', icon: Wallet },
];

export default function PayrollPage() {
  const [tab, setTab] = useState('payouts');
  const [payouts, setPayouts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        fetchWithAuth('/api/payouts'),
        fetchWithAuth('/api/employee-accounts'),
      ]);
      if (p.success) setPayouts(p.data || []); else toast.error(p.error || 'Failed to load payouts');
      if (a.success) setAccounts(a.data || []); else toast.error(a.error || 'Failed to load employee accounts');
    } catch (err) {
      toast.error('Failed to load payroll data');
      console.error('[payroll] load failed:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const deletePayout = async (id) => {
    if (!window.confirm('Delete this payout record?')) return;
    const res = await fetchWithAuth(`/api/payouts/${id}`, { method: 'DELETE' });
    if (res.success) { toast.success('Payout deleted'); load(); }
    else toast.error(res.error || 'Failed to delete payout');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">Salary payouts and employee accounts</p>
        </div>
        <button
          onClick={() => setShowPayoutModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Record Payout
        </button>
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : tab === 'payouts' ? (
          payouts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No payouts recorded</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th><th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{p.staff_name}</td>
                    <td className="px-4 py-3 capitalize">{p.payout_type}</td>
                    <td className="px-4 py-3">{money(p.currency, p.amount)}</td>
                    <td className="px-4 py-3">{p.payout_date ? new Date(p.payout_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.reference || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deletePayout(p.id)} title="Delete" className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : accounts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No employee accounts linked</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Balance</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{a.staff_name}</td>
                  <td className="px-4 py-3">{a.account_name}</td>
                  <td className="px-4 py-3">{money(a.currency, a.balance)}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PayoutModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        staffId={null}
        onSuccess={load}
      />
    </div>
  );
}
