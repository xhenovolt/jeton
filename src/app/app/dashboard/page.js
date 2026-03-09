'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Users, Handshake, DollarSign, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import Link from 'next/link';

function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    rose: 'from-rose-500 to-rose-600',
    cyan: 'from-cyan-500 to-cyan-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 opacity-80" />
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{title}</div>
      {subtitle && <div className="text-xs opacity-75 mt-1">{subtitle}</div>}
    </div>
  );
}

function fmt(n, currency = 'UGX') {
  if (n === null || n === undefined) return formatCurrency(0, currency);
  const num = parseFloat(n);
  if (num >= 1000000) return `${currency} ${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${currency} ${(num / 1000).toFixed(1)}K`;
  return formatCurrency(num, currency);
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetchWithAuth('/api/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const d = data || {};
  const fin = d.financial || {};
  const deals = d.deals || {};

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Founder Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time business overview</p>
        </div>
        <div className="text-xs text-muted-foreground">Auto-refreshes every 30s</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Net Position" value={fmt(fin.net_position)} subtitle={`${fin.total_transactions || 0} transactions`} icon={DollarSign} color="green" />
        <StatCard title="Total Income" value={fmt(fin.total_income)} subtitle={`${fin.income_transactions || 0} payments`} icon={TrendingUp} color="blue" />
        <StatCard title="Total Expenses" value={fmt(fin.total_expenses)} subtitle={`${fin.expense_transactions || 0} expenses`} icon={ArrowDownRight} color="rose" />
        <StatCard title="Active Deals" value={deals.active_deals || 0} subtitle={fmt(deals.active_value) + ' pipeline'} icon={Handshake} color="purple" />
      </div>

      {/* Middle Row: Pipeline + Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prospect Pipeline */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Prospect Pipeline</h2>
            <Link href="/app/prospects" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          {(d.pipeline || []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No active prospects yet</p>
          ) : (
            <div className="space-y-3">
              {(d.pipeline || []).map((stage) => (
                <div key={stage.stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium capitalize">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{stage.count} prospects</span>
                    <span className="text-sm font-medium">{fmt(stage.total_value)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Balances */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Account Balances</h2>
            <Link href="/app/finance/accounts" className="text-sm text-blue-600 hover:underline">Manage →</Link>
          </div>
          {(d.accounts || []).length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No accounts set up</p>
              <Link href="/app/finance/accounts" className="text-sm text-blue-600 hover:underline mt-1 inline-block">Add account →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(d.accounts || []).map((acct) => (
                <div key={acct.account_id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{acct.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{acct.type}</div>
                  </div>
                  <span className={`text-sm font-bold ${parseFloat(acct.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(acct.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Upcoming Follow-ups + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Follow-ups */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Upcoming Follow-ups</h2>
            <Link href="/app/followups" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          {(d.upcomingFollowups || []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No upcoming follow-ups</p>
          ) : (
            <div className="space-y-3">
              {(d.upcomingFollowups || []).slice(0, 5).map((f) => (
                <div key={f.id} className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-sm font-medium">{f.prospect_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{f.type}{f.summary ? ` - ${f.summary}` : ''}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {new Date(f.scheduled_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          {(d.recentActivity || []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {(d.recentActivity || []).slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <div>
                    <span className="font-medium capitalize">{a.action}</span>
                    <span className="text-muted-foreground ml-1">{a.entity_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
