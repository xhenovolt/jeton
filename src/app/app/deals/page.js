'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, ChevronRight, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';

const STATUS_COLORS = {
  draft: 'bg-muted text-foreground', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700', disputed: 'bg-orange-100 text-orange-700',
};

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchDeals(); }, [statusFilter]);

  const fetchDeals = async () => {
    try {
      let url = '/api/deals';
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) setDeals(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const totalValue = deals.reduce((s, d) => s + parseFloat(d.total_amount || 0), 0);
  const totalPaid = deals.reduce((s, d) => s + parseFloat(d.paid_amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">{deals.length} deals &middot; ${totalValue.toLocaleString()} total &middot; ${totalPaid.toLocaleString()} collected</p>
        </div>
        <Link href="/app/deals/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Deal
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setStatusFilter(''); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!statusFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
        {['draft','sent','accepted','in_progress','completed','cancelled'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setLoading(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{s.replace(/_/g,' ')}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No deals found</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {deals.map(d => {
            const paid = parseFloat(d.paid_amount || 0);
            const total = parseFloat(d.total_amount || 0);
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
            return (
              <Link key={d.id} href={`/app/deals/${d.id}`} className="flex items-center justify-between p-4 hover:bg-muted transition">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{d.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[d.status]}`}>{d.status.replace(/_/g,' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{d.client_name}</span>
                    {d.offering_name && <span>{d.offering_name}</span>}
                    {d.payment_count > 0 && <span>{d.payment_count} payments</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">${total.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{pct}% paid</div>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-200'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
