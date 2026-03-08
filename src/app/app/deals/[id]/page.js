'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, Calendar, CreditCard, Plus, CheckCircle, Clock, FileText, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700', disputed: 'bg-orange-100 text-orange-700',
};
const PAY_STATUS = { pending: 'bg-yellow-100 text-yellow-700', completed: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700', refunded: 'bg-gray-100 text-gray-700' };

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', account_id: '', method: 'bank_transfer', reference: '' });
  const [saving, setSaving] = useState(false);
  const [statusEdit, setStatusEdit] = useState('');

  useEffect(() => { fetchDeal(); fetchAccounts(); }, [id]);

  const fetchDeal = async () => {
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`);
      const json = await res.json();
      if (json.success) { setDeal(json.data); setStatusEdit(json.data.status); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAccounts = async () => {
    try { const res = await fetchWithAuth('/api/accounts'); const j = await res.json(); if (j.success) setAccounts(j.data); } catch {}
  };

  const updateStatus = async (newStatus) => {
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      if ((await res.json()).success) fetchDeal();
    } catch (err) { console.error(err); }
  };

  const submitPayment = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { deal_id: id, amount: parseFloat(payForm.amount), account_id: payForm.account_id, method: payForm.method, status: 'completed', reference: payForm.reference || undefined };
      const res = await fetchWithAuth('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) { setShowPayForm(false); setPayForm({ amount: '', account_id: '', method: 'bank_transfer', reference: '' }); fetchDeal(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!deal) return <div className="p-6 text-center text-gray-500">Deal not found</div>;

  const paid = parseFloat(deal.paid_amount || 0);
  const total = parseFloat(deal.total_amount || 0);
  const remaining = total - paid;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/app/deals')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
          <p className="text-sm text-gray-500">{deal.client_name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_COLORS[deal.status]}`}>{deal.status.replace(/_/g,' ')}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Value', value: `$${total.toLocaleString()}`, icon: FileText, color: 'blue' },
          { label: 'Paid', value: `$${paid.toLocaleString()}`, icon: CheckCircle, color: 'emerald' },
          { label: 'Remaining', value: `$${remaining.toLocaleString()}`, icon: Clock, color: remaining > 0 ? 'orange' : 'emerald' },
          { label: 'Progress', value: `${pct}%`, icon: DollarSign, color: 'purple' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1"><c.icon className="w-3.5 h-3.5" />{c.label}</div>
            <div className={`text-xl font-bold text-${c.color}-600`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Payment Progress</span><span className="font-medium">{pct}%</span></div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deal Details */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Details</h2>
          {deal.description && <p className="text-sm text-gray-600">{deal.description}</p>}
          <div className="text-sm space-y-2">
            {deal.offering_name && <div className="flex justify-between"><span className="text-gray-400">Offering</span><span>{deal.offering_name}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Created</span><span>{new Date(deal.created_at).toLocaleDateString()}</span></div>
            {deal.start_date && <div className="flex justify-between"><span className="text-gray-400">Start</span><span>{new Date(deal.start_date).toLocaleDateString()}</span></div>}
            {deal.end_date && <div className="flex justify-between"><span className="text-gray-400">End</span><span>{new Date(deal.end_date).toLocaleDateString()}</span></div>}
            {deal.closed_at && <div className="flex justify-between"><span className="text-gray-400">Closed</span><span>{new Date(deal.closed_at).toLocaleDateString()}</span></div>}
          </div>
          <div className="pt-3 border-t">
            <label className="text-xs text-gray-400">Update Status</label>
            <div className="flex gap-2 mt-1">
              <select value={statusEdit} onChange={e => setStatusEdit(e.target.value)} className="flex-1 px-2 py-1.5 border rounded-lg text-sm">
                {['draft','sent','accepted','in_progress','completed','cancelled','disputed'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <button onClick={() => updateStatus(statusEdit)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>

        {/* Payments */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Payments ({deal.payments?.length || 0})</h2>
            {remaining > 0 && (
              <button onClick={() => { setPayForm(f => ({ ...f, amount: remaining.toString() })); setShowPayForm(true); }} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            )}
          </div>

          {showPayForm && (
            <form onSubmit={submitPayment} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex justify-between items-center"><span className="text-sm font-medium">Record Payment</span><button type="button" onClick={() => setShowPayForm(false)}><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" placeholder="Amount" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required className="px-3 py-2 border rounded-lg text-sm" />
                <select value={payForm.account_id} onChange={e => setPayForm(f => ({ ...f, account_id: e.target.value }))} required className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
                  {['bank_transfer','credit_card','cash','check','crypto','other'].map(m => <option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                </select>
                <input placeholder="Reference (optional)" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Recording...' : 'Record Payment'}</button>
            </form>
          )}

          {(!deal.payments || deal.payments.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">No payments recorded yet</p>
          ) : (
            <div className="divide-y">
              {deal.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">${parseFloat(p.amount).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${PAY_STATUS[p.status]}`}>{p.status}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 ml-6">
                      {p.method?.replace(/_/g, ' ')} {p.reference && `· ${p.reference}`} · {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
