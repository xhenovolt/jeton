'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, Users, Handshake, DollarSign, TrendingUp, Calendar,
  ArrowUpRight, ArrowDownRight, Wallet, Activity, AlertTriangle,
  Clock, Zap, ExternalLink,
} from 'lucide-react';
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
    amber: 'from-amber-500 to-amber-600',
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

const ATTENTION_ICONS = {
  overdue_followup: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'Overdue follow-up' },
  overdue_deal: { icon: Clock, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Overdue deal' },
  unlinked_op: { icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Op without expense' },
};

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
  const ops = d.operations || {};
  const attention = d.attention || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Founder Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time business overview — Xhenvolt</p>
        </div>
        <div className="text-xs text-muted-foreground">Auto-refreshes every 30s</div>
      </div>

      {/* Attention Items Banner */}
      {attention.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Needs Your Attention ({attention.length})</span>
          </div>
          <div className="space-y-2">
            {attention.slice(0, 8).map((item, i) => {
              const cfg = ATTENTION_ICONS[item.item_type] || ATTENTION_ICONS.unlinked_op;
              const ItemIcon = cfg.icon;
              const href = item.item_type === 'overdue_deal' ? `/app/deals/${item.item_id}`
                : item.item_type === 'unlinked_op' ? '/app/operations'
                : '/app/followups';
              return (
                <Link key={i} href={href} className={`flex items-center justify-between px-3 py-2 rounded-lg ${cfg.bg} hover:opacity-80 transition`}>
                  <div className="flex items-center gap-2">
                    <ItemIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className="text-sm font-medium text-foreground">{item.label || 'Item'}</span>
                    <span className="text-xs text-muted-foreground">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.detail && <span className="text-xs text-muted-foreground">{new Date(item.detail).toLocaleDateString()}</span>}
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Net Position" value={fmt(fin.net_position)} subtitle={`${fin.total_transactions || 0} transactions`} icon={DollarSign} color="green" />
        <StatCard title="Total Income" value={fmt(fin.total_income)} subtitle={`${fin.income_transactions || 0} payments`} icon={TrendingUp} color="blue" />
        <StatCard title="Total Expenses" value={fmt(fin.total_expenses)} subtitle={`${fin.expense_transactions || 0} expenses`} icon={ArrowDownRight} color="rose" />
        <StatCard title="Active Deals" value={deals.active_deals || 0} subtitle={fmt(deals.active_value) + ' pipeline'} icon={Handshake} color="purple" />
      </div>

      {/* Operations + Deals Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Activity className="w-3.5 h-3.5" />Operations</div>
          <div className="text-xl font-bold text-foreground">{ops.total_ops || 0}</div>
          <div className="text-xs text-muted-foreground">{ops.month_ops || 0} this month</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Zap className="w-3.5 h-3.5" />Ops Spending</div>
          <div className="text-xl font-bold text-orange-600">{fmt(ops.total_spent)}</div>
          <div className="text-xs text-muted-foreground">{fmt(ops.month_spent)} this month</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="w-3.5 h-3.5" />Outstanding</div>
          <div className="text-xl font-bold text-amber-600">{fmt(deals.outstanding_balance)}</div>
          <div className="text-xs text-muted-foreground">{deals.overdue_deals || 0} overdue deals</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="w-3.5 h-3.5" />Unlinked Ops</div>
          <div className={`text-xl font-bold ${parseInt(ops.unlinked_ops) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{ops.unlinked_ops || 0}</div>
          <div className="text-xs text-muted-foreground">{parseInt(ops.unlinked_ops) > 0 ? 'need expense linking' : 'all linked'}</div>
        </div>
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

      {/* Monthly Financials Chart */}
      {(d.monthlyFinancials || []).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Financial Trend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(d.monthlyFinancials || []).slice(0, 6).reverse().map((m, i) => {
              const income = parseFloat(m.income || 0);
              const expenses = parseFloat(m.expenses || 0);
              const net = income - expenses;
              return (
                <div key={i} className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-2">{m.month || m.period}</div>
                  <div className="text-xs text-emerald-600">+{fmt(income)}</div>
                  <div className="text-xs text-red-500">-{fmt(expenses)}</div>
                  <div className={`text-sm font-bold mt-1 ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(net)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
