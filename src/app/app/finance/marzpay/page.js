'use client';

/**
 * MarzPay Control Center.
 *
 * Only exposes operations the live API was confirmed to support:
 *   - credential verification  (GET /collect-money/services)
 *   - transactions + balance   (GET /transactions)
 *   - collection request       (POST /collect-money)
 *   - collection status        (GET /collect-money/{uuid})
 *   - provider lists for collection and disbursement
 *
 * Balance comes from the /transactions payload, not MarzPay's /balance
 * endpoint. /balance answers 403 IP_WHITELIST_REQUIRED, and enabling that
 * whitelist would be actively harmful here: Vercel functions egress from a
 * rotating IP pool, so collections would start failing the moment the
 * function moved. /transactions is not IP-restricted and carries the same
 * figure.
 *
 * There is also no payout button — disbursement providers are listed because
 * the account genuinely has them, but no send-money call has been verified
 * end to end.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, X, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Wallet,
  KeyRound, Star, Trash2, Send, Loader2, ArrowUpRight, ArrowDownRight, BookOpen,
} from 'lucide-react';
import { fetchWithAuth, requestOk, requestError } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
// The same helper /finance/ledger, /reports and the rest of finance use, so
// MarzPay figures are formatted identically rather than with a local variant.
import { formatCurrency } from '@/lib/format-currency';

const STATUS_STYLES = {
  verified:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  unverified: 'bg-muted text-muted-foreground',
  rejected:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  error:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const fmt = (n, c = 'UGX') =>
  n === null || n === undefined || n === '' ? '—' : formatCurrency(n, c || 'UGX');

export default function MarzPayPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', description: '', environment: 'live',
    base_url: 'https://wallet.wearemarz.com/api/v1',
    api_key: '', api_secret: '', webhook_secret: '', is_default: false,
  });
  const [saving, setSaving] = useState(false);

  const [rotateFor, setRotateFor] = useState(null);
  const [rotateForm, setRotateForm] = useState({ api_key: '', api_secret: '', webhook_secret: '' });

  const [txData, setTxData] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [verifying, setVerifying] = useState(null);

  const [collectFor, setCollectFor] = useState(null);
  const [collectForm, setCollectForm] = useState({ amount: '', phone: '', description: '' });
  const [collecting, setCollecting] = useState(false);

  // Accounting position: MarzPay's own figures beside what the internal
  // ledger holds, plus anything still waiting to be posted.
  const [acct, setAcct] = useState(null);
  const [acctLoading, setAcctLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const json = await fetchWithAuth('/api/finance/marzpay/accounts');
      if (!requestOk(json)) {
        setError(requestError(json, 'Could not load accounts.'));
        return;
      }
      const list = Array.isArray(json.data) ? json.data : [];
      setAccounts(list);
      setError('');
      setSelected(prev => prev ?? list.find(a => a.is_default)?.id ?? list[0]?.id ?? null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const loadTransactions = useCallback(async (id) => {
    if (!id) return;
    setTxLoading(true);
    try {
      const json = await fetchWithAuth(`/api/finance/marzpay/accounts/${id}/transactions?include=services&per_page=25`);
      if (!requestOk(json)) {
        toast.error(requestError(json, 'Could not load transactions.'), { duration: 9000 });
        setTxData(null);
        return;
      }
      setTxData(json);
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setTxLoading(false);
    }
  }, [toast]);

  const loadAccounting = useCallback(async (id) => {
    if (!id) return;
    setAcctLoading(true);
    try {
      const json = await fetchWithAuth(`/api/finance/marzpay/reconcile?account_id=${id}`);
      if (!requestOk(json)) {
        toast.error(requestError(json, 'Could not load the accounting position.'), { duration: 9000 });
        setAcct(null);
        return;
      }
      setAcct(json);
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setAcctLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!selected) return;
    loadTransactions(selected);
    loadAccounting(selected);
  }, [selected, loadTransactions, loadAccounting]);

  const runReconcile = async () => {
    if (!acct?.unreconciled?.length) return;
    const total = acct.unreconciled.reduce((s, u) => s + u.amount, 0);
    if (!confirm(
      `Post ${acct.unreconciled.length} completed collection(s) totalling ${fmt(total)} into the ledger?\n\n` +
      `They will appear in Ledger, Reports and Financial Intelligence as revenue. Running this again will not post them twice.`
    )) return;

    setReconciling(true);
    try {
      const json = await fetchWithAuth('/api/finance/marzpay/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selected }),
      });
      if (!requestOk(json)) {
        toast.error(json.error || 'Reconciliation failed.', { duration: 10000 });
        return;
      }
      if (json.failures?.length) {
        toast.error(`${json.failures.length} could not be posted: ${json.failures[0].error}`, { duration: 12000 });
      }
      toast.success(json.message, { duration: 9000 });
      loadAccounting(selected);
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setReconciling(false);
    }
  };

  const verify = async (id) => {
    setVerifying(id);
    try {
      const json = await fetchWithAuth(`/api/finance/marzpay/accounts/${id}/verify`, { method: 'POST' });
      if (json.ok) toast.success(json.message || 'MarzPay accepted the credentials');
      else toast.error(json.error || 'Verification failed', { duration: 9000 });
      loadAccounts();
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setVerifying(null);
    }
  };

  const addAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const json = await fetchWithAuth('/api/finance/marzpay/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (!requestOk(json)) {
        toast.error(requestError(json, 'Could not add the account.'), { duration: 9000 });
        return;
      }
      toast.success(`"${json.data.name}" added. Verify it to confirm the credentials work.`);
      setShowAdd(false);
      setAddForm({ name: '', description: '', environment: 'live',
        base_url: 'https://wallet.wearemarz.com/api/v1',
        api_key: '', api_secret: '', webhook_secret: '', is_default: false });
      loadAccounts();
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  const rotate = async (e) => {
    e.preventDefault();
    if (!rotateForm.api_key && !rotateForm.api_secret && !rotateForm.webhook_secret) {
      toast.error('Enter at least one credential to replace.');
      return;
    }
    setSaving(true);
    try {
      const json = await fetchWithAuth(`/api/finance/marzpay/accounts/${rotateFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rotateForm),
      });
      if (!requestOk(json)) {
        toast.error(json.error || 'Could not rotate the credentials.', { duration: 9000 });
        return;
      }
      toast.success('Credentials replaced. Verify the account to confirm the new ones work.');
      setRotateFor(null);
      setRotateForm({ api_key: '', api_secret: '', webhook_secret: '' });
      loadAccounts();
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id, body, okMsg) => {
    try {
      const json = await fetchWithAuth(`/api/finance/marzpay/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!requestOk(json)) {
        toast.error(json.error || 'Update failed.', { duration: 9000 });
        return;
      }
      toast.success(okMsg);
      loadAccounts();
    } catch { toast.error('Could not reach the server.'); }
  };

  const removeAccount = async (a) => {
    if (!confirm(`Remove "${a.name}"? Accounts that have moved money cannot be removed.`)) return;
    try {
      const json = await fetchWithAuth(`/api/finance/marzpay/accounts/${a.id}`, { method: 'DELETE' });
      if (!requestOk(json)) {
        toast.error(json.error || 'Could not remove the account.', { duration: 10000 });
        return;
      }
      toast.success('Account removed');
      setSelected(null);
      loadAccounts();
    } catch { toast.error('Could not reach the server.'); }
  };

  const requestCollection = async (e) => {
    e.preventDefault();
    const amt = Number(collectForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount.'); return; }
    if (!confirm(`Request ${fmt(amt)} from ${collectForm.phone}? They will be prompted on their phone to approve it.`)) return;

    setCollecting(true);
    try {
      const json = await fetchWithAuth('/api/finance/marzpay/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...collectForm, amount: amt, account_id: collectFor.id }),
      });
      if (!requestOk(json)) {
        toast.error(requestError(json, 'Collection failed.'), { duration: 12000 });
        return;
      }
      toast.success(json.message || 'Collection requested.', { duration: 9000 });
      setCollectFor(null);
      setCollectForm({ amount: '', phone: '', description: '' });
      loadTransactions(selected);
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setCollecting(false);
    }
  };

  const current = accounts.find(a => a.id === selected) || null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MarzPay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mobile-money accounts, balances and collections. Credentials are encrypted at rest and never returned to the browser.
          </p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition shrink-0">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <span>{error}</span>
          <button onClick={() => { setLoading(true); loadAccounts(); }} className="underline font-medium shrink-0">Retry</button>
        </div>
      )}

      {/* ── ADD ACCOUNT ─────────────────────────────────────────────────── */}
      {showAdd && (
        <form onSubmit={addAccount} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">New MarzPay account</h2>
            <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Adding an account needs no environment variables and no redeploy. The key and secret are encrypted before they are stored.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Account name *</label>
              <input required value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Xhenvolt Collections" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Environment</label>
              <select value={addForm.environment} onChange={e => setAddForm(f => ({ ...f, environment: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">
                <option value="live">live</option>
                <option value="sandbox">sandbox</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Base URL</label>
              <input value={addForm.base_url} onChange={e => setAddForm(f => ({ ...f, base_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">API key *</label>
              <input required type="password" autoComplete="off" value={addForm.api_key}
                onChange={e => setAddForm(f => ({ ...f, api_key: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">API secret *</label>
              <input required type="password" autoComplete="off" value={addForm.api_secret}
                onChange={e => setAddForm(f => ({ ...f, api_secret: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Webhook signing secret (optional)</label>
              <input type="password" autoComplete="off" value={addForm.webhook_secret}
                onChange={e => setAddForm(f => ({ ...f, webhook_secret: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono" />
              <p className="text-xs text-muted-foreground mt-1">
                Payments are re-confirmed against the API regardless, so this is defence in depth.
              </p>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={addForm.is_default}
                onChange={e => setAddForm(f => ({ ...f, is_default: e.target.checked }))} />
              Make this the default account
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Add account'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* ── ACCOUNTS ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No MarzPay accounts yet. Add one to start taking mobile-money payments.
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(a => (
            <div key={a.id}
              className={`bg-card border rounded-xl p-4 transition cursor-pointer ${a.id === selected ? 'border-blue-500' : 'border-border hover:border-muted-foreground/40'}`}
              onClick={() => setSelected(a.id)}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Wallet className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="font-medium text-foreground">{a.name}</p>
                    {a.is_default && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                        <Star className="w-3 h-3" /> default
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[a.verification_status] || STATUS_STYLES.unverified}`}>
                      {a.verification_status}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.environment}</span>
                    {!a.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">inactive</span>}
                  </div>
                  {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-mono">{a.api_key_masked}</span>
                    {a.last_known_balance !== null && (
                      <span className="text-foreground font-medium">
                        balance {fmt(a.last_known_balance, a.last_known_currency || 'UGX')}
                      </span>
                    )}
                    {a.last_verified_at && <span>verified {new Date(a.last_verified_at).toLocaleString()}</span>}
                  </div>
                  {a.last_error && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{a.last_error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => verify(a.id)} disabled={verifying === a.id} title="Verify credentials (moves no money)"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-muted disabled:opacity-50">
                    {verifying === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setCollectFor(a); setSelected(a.id); }} title="Request a payment"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-muted">
                    <Send className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setRotateFor(a); setRotateForm({ api_key: '', api_secret: '', webhook_secret: '' }); }}
                    title="Replace credentials"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-muted">
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {!a.is_default && (
                    <button onClick={() => patch(a.id, { is_default: true }, `"${a.name}" is now the default`)} title="Make default"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-muted">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => patch(a.id, { is_active: !a.is_active }, a.is_active ? 'Account deactivated' : 'Account activated')}
                    title={a.is_active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeAccount(a)} title="Remove account"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-muted">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ROTATE ──────────────────────────────────────────────────────── */}
      {rotateFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={rotate} className="bg-card border border-border rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Replace credentials</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{rotateFor.name} · {rotateFor.api_key_masked}</p>
              </div>
              <button type="button" onClick={() => setRotateFor(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a field blank to keep the current value. Replacing credentials resets the account to unverified.
            </p>
            {['api_key', 'api_secret', 'webhook_secret'].map(f => (
              <div key={f}>
                <label className="text-xs text-muted-foreground">{f.replace(/_/g, ' ')}</label>
                <input type="password" autoComplete="off" value={rotateForm[f]}
                  onChange={e => setRotateForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Replace'}
              </button>
              <button type="button" onClick={() => setRotateFor(null)}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── COLLECT ─────────────────────────────────────────────────────── */}
      {collectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={requestCollection} className="bg-card border border-border rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Request a payment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">via {collectFor.name}</p>
              </div>
              <button type="button" onClick={() => setCollectFor(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>This prompts a real customer to approve a real payment. Resubmitting the same reference will not charge twice.</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount (UGX) *</label>
              <input required type="number" min="1" step="1" value={collectForm.amount}
                onChange={e => setCollectForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Customer phone *</label>
              <input required value={collectForm.phone} placeholder="0741341483 or +256741341483"
                onChange={e => setCollectForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <input value={collectForm.description} placeholder="What this payment is for"
                onChange={e => setCollectForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={collecting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {collecting ? 'Requesting...' : 'Request payment'}
              </button>
              <button type="button" onClick={() => setCollectFor(null)}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── ACCOUNTING ──────────────────────────────────────────────────── */}
      {current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Accounting — {current.name}
            </h2>
            <button onClick={() => loadAccounting(current.id)} disabled={acctLoading}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${acctLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {acctLoading && !acct ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !acct ? (
            <div className="text-sm text-muted-foreground">No accounting data for this account.</div>
          ) : (
            <>
              {/* Same three-card shape as /finance/ledger, so the numbers read
                  the same way across finance. */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Credits (Collections)
                  </div>
                  <div className="text-xl font-bold text-emerald-600">{fmt(acct.summary.total_credits)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{acct.summary.completed_count} completed</div>
                </div>
                <div className="bg-card rounded-xl border p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> Debits (Payouts)
                  </div>
                  <div className="text-xl font-bold text-red-600">{fmt(acct.summary.total_debits)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {acct.summary.total_debits === 0 ? 'no disbursements recorded' : 'completed'}
                  </div>
                </div>
                <div className="bg-card rounded-xl border p-4">
                  <div className="text-xs text-muted-foreground mb-1">Net through MarzPay</div>
                  <div className={`text-xl font-bold ${acct.summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(acct.summary.net)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {acct.summary.total_count} transaction{acct.summary.total_count === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              {/* Provider-side vs book-side, side by side. If these disagree,
                  something is unposted — which is exactly what the panel below
                  is for. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border p-4">
                  <div className="text-xs text-muted-foreground mb-1">In the ledger</div>
                  <div className="text-lg font-semibold text-foreground">{fmt(acct.books.ledger_total)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{acct.books.ledger_entries} entries posted</div>
                </div>
                <div className="bg-card rounded-xl border p-4">
                  <div className="text-xs text-muted-foreground mb-1">Reconciled</div>
                  <div className="text-lg font-semibold text-foreground">{fmt(acct.summary.reconciled_amount)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{acct.summary.reconciled_count} transactions</div>
                </div>
                <div className={`rounded-xl border p-4 ${acct.summary.unreconciled_count > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-card'}`}>
                  <div className="text-xs text-muted-foreground mb-1">Awaiting posting</div>
                  <div className={`text-lg font-semibold ${acct.summary.unreconciled_count > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                    {fmt(acct.summary.unreconciled_amount)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{acct.summary.unreconciled_count} transactions</div>
                </div>
              </div>

              {/* Pending / failed, so money in flight is never invisible. */}
              {(acct.summary.pending_count > 0 || acct.summary.failed_count > 0) && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {acct.summary.pending_count > 0 && <span>{acct.summary.pending_count} pending</span>}
                  {acct.summary.failed_count > 0 && <span>{acct.summary.failed_count} failed</span>}
                </div>
              )}

              {/* ── RECONCILIATION ─────────────────────────────────────── */}
              {acct.unreconciled.length > 0 ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-foreground">Not yet in the ledger</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Posting these makes them appear as revenue in Ledger, Reports and Financial Intelligence. Running it twice posts nothing twice.
                      </p>
                    </div>
                    <button onClick={runReconcile} disabled={reconciling}
                      className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0">
                      {reconciling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                      {reconciling ? 'Posting...' : `Post ${acct.unreconciled.length} to ledger`}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Reference</th>
                          <th className="text-left px-4 py-2 font-medium">From</th>
                          <th className="text-left px-4 py-2 font-medium">Description</th>
                          <th className="text-right px-4 py-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {acct.unreconciled.map(u => (
                          <tr key={u.id}>
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{u.reference}</td>
                            <td className="px-4 py-2 text-muted-foreground">{u.phone_number ?? '—'}</td>
                            <td className="px-4 py-2 text-foreground max-w-xs truncate">
                              {u.description ?? '—'}
                              {!u.mapped && (
                                <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                                  no internal account mapped
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-emerald-600 whitespace-nowrap">
                              +{fmt(u.amount, u.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Every completed collection is posted to the ledger.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BALANCE, PROVIDERS, TRANSACTIONS ────────────────────────────── */}
      {current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Provider activity — {current.name}</h2>
            <button onClick={() => loadTransactions(current.id)} disabled={txLoading}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${txLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {txLoading && !txData ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !txData ? (
            <div className="text-sm text-muted-foreground">No data loaded for this account.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">Provider balance</div>
                  <div className="text-xl font-bold text-foreground">
                    {txData.balance ? fmt(txData.balance.raw, txData.balance.currency) : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Read from the transactions endpoint
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">Collection providers</div>
                  <div className="text-xl font-bold text-foreground">{txData.services?.collection?.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {(txData.services?.collection ?? []).map(p => p.provider).join(', ') || '—'}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">Disbursement providers</div>
                  <div className="text-xl font-bold text-foreground">{txData.services?.disbursement?.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {(txData.services?.disbursement ?? []).map(p => p.provider).join(', ') || '—'}
                  </div>
                </div>
              </div>

              {txData.services?.errors?.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{txData.services.errors.join(' · ')}</span>
                </div>
              )}

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
                  Provider transactions
                </div>
                {(txData.transactions ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">No transactions on this account yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">When</th>
                          <th className="text-left px-4 py-2 font-medium">Description</th>
                          <th className="text-left px-4 py-2 font-medium">Provider</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                          <th className="text-right px-4 py-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {txData.transactions.map(t => (
                          <tr key={t.uuid ?? `${t.reference}-${t.created_at}`}>
                            <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{t.created_at ?? '—'}</td>
                            <td className="px-4 py-2 text-foreground max-w-xs truncate">{t.description ?? '—'}</td>
                            <td className="px-4 py-2 text-muted-foreground">{t.provider ?? '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                t.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : t.status === 'failed'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-muted text-muted-foreground'}`}>
                                {t.status ?? 'unknown'}
                              </span>
                            </td>
                            <td className={`px-4 py-2 text-right font-medium whitespace-nowrap ${
                              t.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {t.type === 'credit' ? '+' : '-'}{fmt(t.amount, t.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
