'use client';

import { useEffect, useState, useCallback } from 'react';

// (Dynamic rendering is inherited from src/app/app/layout.js.)
import Link from 'next/link';
import {
  AlertTriangle, Clock, Flame, Snowflake, Skull, Phone, CalendarX,
  RefreshCw, BellRing, TrendingUp, ChevronRight,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { SkeletonCards } from '@/components/ui/Skeleton';

/**
 * Prospect Intelligence dashboard — the founder's "who needs me now"
 * view. Reads /api/prospects/intelligence and renders classified buckets.
 * Generating alerts POSTs to /alerts, which SELECT-dedups per day.
 */

const CARDS = [
  { key: 'overdue',   label: 'Overdue',        icon: AlertTriangle, tone: 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300' },
  { key: 'due_today', label: 'Due today',      icon: Clock,         tone: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300' },
  { key: 'hot',       label: 'Hot (<48h)',     icon: Flame,         tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
  { key: 'warm',      label: 'Warm',           icon: TrendingUp,    tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300' },
  { key: 'active',    label: 'Active',         icon: TrendingUp,    tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { key: 'dormant',   label: 'Dormant (>7d)',  icon: Snowflake,     tone: 'text-slate-600 bg-slate-50 dark:bg-slate-900/60 dark:text-slate-300' },
  { key: 'dead',      label: 'Dead (>30d)',    icon: Skull,         tone: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300' },
  { key: 'converted', label: 'Converted',      icon: TrendingUp,    tone: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200' },
];

function ProspectRow({ p }) {
  const overdueHrs = Number(p.hours_until_followup);
  const isOverdue = Number.isFinite(overdueHrs) && overdueHrs < 0;
  const idle = Math.round(Number(p.days_since_last_activity || 0));
  return (
    <Link href={`/app/prospects/${p.id}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted/60 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{p.company_name || 'Untitled'}</div>
        <div className="truncate text-xs text-muted-foreground">
          {p.contact_name || 'No contact'}
          {p.phone ? ` · ${p.phone}` : ''}
          {p.stage ? ` · ${p.stage}` : ''}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        {isOverdue ? (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {Math.round(-overdueHrs / 24)}d overdue
          </span>
        ) : p.next_followup_date ? (
          <span className="text-muted-foreground">Due {p.next_followup_date}</span>
        ) : (
          <span className="text-muted-foreground">Idle {idle}d</span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

function Bucket({ title, icon: Icon, rows, empty, tone }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className={`p-1.5 rounded-md ${tone || 'bg-muted text-foreground'}`}><Icon className="w-4 h-4" /></span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <div className="p-2 max-h-[380px] overflow-y-auto">
        {rows.length === 0
          ? <div className="text-center text-xs text-muted-foreground py-6">{empty}</div>
          : rows.map(p => <ProspectRow key={p.id} p={p} />)}
      </div>
    </div>
  );
}

export default function ProspectIntelligencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/prospects/intelligence');
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed');
      setData(j);
    } catch (e) {
      toast.error(e.message || 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const generateAlerts = async () => {
    setGenerating(true);
    try {
      const res = await fetchWithAuth('/api/prospects/intelligence/alerts', { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed');
      toast.success(`Alerts: ${j.created} created, ${j.skipped} skipped (of ${j.total_overdue} overdue)`);
    } catch (e) {
      toast.error(e.message || 'Failed to generate alerts');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-6"><SkeletonCards count={8} /></div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">No data.</div>;

  const s = data.summary || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prospect Intelligence</h1>
          <p className="text-sm text-muted-foreground">Follow-up discipline, dormancy, and hygiene — refreshed live.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={generateAlerts}
            disabled={generating || !s.overdue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <BellRing className="w-4 h-4" />
            {generating ? 'Sending…' : `Alert owners (${s.overdue || 0})`}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CARDS.map(c => (
          <div key={c.key} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${c.tone}`}><c.icon className="w-4 h-4" /></span>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{s[c.key] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Hygiene */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Missing phone</span>
            <span className="ml-auto font-semibold text-foreground">{s.missing_phone ?? 0}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm">
            <CalendarX className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">No next action</span>
            <span className="ml-auto font-semibold text-foreground">{s.missing_next_action ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Risk buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bucket title="Overdue follow-ups" icon={AlertTriangle} tone={CARDS[0].tone} rows={data.overdue} empty="Nothing overdue — 🎯" />
        <Bucket title="Due today"          icon={Clock}         tone={CARDS[1].tone} rows={data.due_today} empty="Nothing scheduled for today." />
        <Bucket title="Hot (next 48h)"     icon={Flame}         tone={CARDS[2].tone} rows={data.hot} empty="No hot leads." />
        <Bucket title="Dormant (>7d)"      icon={Snowflake}     tone={CARDS[5].tone} rows={data.dormant} empty="No dormant prospects." />
        <Bucket title="Dead (>30d)"        icon={Skull}         tone={CARDS[6].tone} rows={data.dead} empty="No dead prospects." />
        <Bucket title="Missing phone"      icon={Phone}         tone="bg-muted text-foreground" rows={data.missing_phone} empty="All prospects have phone numbers." />
        <Bucket title="Missing next action" icon={CalendarX}    tone="bg-muted text-foreground" rows={data.missing_next_action} empty="Every prospect has a next step." />
      </div>

      {/* Warm by system */}
      {data.warm_by_system?.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Active pipeline by system</h3>
            <p className="text-xs text-muted-foreground">Hot + warm + active prospects grouped by product.</p>
          </div>
          <div className="p-2">
            {data.warm_by_system.map(row => (
              <div key={row.system_id ?? row.system_name} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-foreground">{row.system_name}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
