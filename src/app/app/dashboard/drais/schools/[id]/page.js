'use client';

/**
 * DRAIS — per-school control center.
 *
 * Real data from DRAIS for ONE school: subscription/status, usage (learners,
 * staff, Cloudinary storage, DB footprint), staff directory, and live feature
 * controls (SMS kill-switch + module toggles). Suspend / reactivate inline.
 *
 * All data flows through Jeton's permission-gated /api/drais/* proxy routes.
 */
import { useState, useEffect, useCallback, use as usePromise } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Power, AlertTriangle, Users, HardDrive, Database,
  GraduationCap, MessageSquare, Boxes, CheckCircle, XCircle,
} from 'lucide-react';

const j = (u, opts) => fetch(u, opts).then((r) => r.json());
const fmtBytesMb = (mb) => (mb == null ? '—' : `${Number(mb).toLocaleString()} MB`);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString());

export default function SchoolControlPage({ params }) {
  const { id } = usePromise(params); // id = external_id
  const [school, setSchool] = useState(null);
  const [usage, setUsage] = useState(null);
  const [staff, setStaff] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [d, u, s, f] = await Promise.all([
      j(`/api/drais/schools/${id}`).catch(() => null),
      j(`/api/drais/schools/${id}/usage`).catch(() => null),
      j(`/api/drais/schools/${id}/staff`).catch(() => null),
      j(`/api/drais/schools/${id}/features`).catch(() => null),
    ]);
    setSchool(d?.data ?? null);
    setUsage(u?.data ?? null);
    setStaff(s?.data ?? null);
    setFeatures(f?.data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function toggleSuspend() {
    const suspended = school?.status === 'suspended';
    setBusy('status'); setMsg('');
    const r = await j(`/api/drais/schools/${id}/${suspended ? 'activate' : 'suspend'}`, { method: 'POST' }).catch(() => null);
    setMsg(r?.success ? (suspended ? 'School reactivated' : 'School suspended') : (r?.error || 'Action failed'));
    setBusy(''); load();
  }

  async function setFeature(change) {
    setBusy('feature'); setMsg('');
    const r = await j(`/api/drais/schools/${id}/features`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change),
    }).catch(() => null);
    setMsg(r?.success ? 'Updated' : (r?.error || 'Update failed'));
    if (r?.success && r.data) setFeatures(r.data);
    setBusy('');
  }

  const suspended = school?.status === 'suspended';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/app/dashboard/drais/schools" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{school?.name || 'School'}</h1>
            <p className="text-xs text-gray-400">{id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={toggleSuspend} disabled={busy === 'status'}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${suspended ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            <Power size={15} /> {suspended ? 'Reactivate' : 'Suspend'}
          </button>
        </div>
      </div>

      {msg && <div className="text-sm rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-200">{msg}</div>}

      {/* Status + subscription */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={suspended ? AlertTriangle : CheckCircle} label="Status" value={school?.status || '—'} tone={suspended ? 'text-red-600' : 'text-green-600'} />
        <Stat icon={Boxes} label="Subscription" value={school?.subscription_status || '—'} sub={school?.subscription_plan || ''} />
        <Stat icon={GraduationCap} label="Learners" value={num(usage?.learners)} />
        <Stat icon={Users} label="Staff" value={num(usage?.staff)} />
      </div>

      {/* Storage + DB footprint */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={HardDrive} label="Cloudinary storage" value={fmtBytesMb(usage?.storage?.file_mb)} sub={`${num(usage?.storage?.file_count)} files`} />
        <Stat icon={Database} label="DB rows" value={num(usage?.db_footprint?.total_rows)} sub="across key tables" />
        <Stat icon={MessageSquare} label="SMS sent (window)" value={num(usage?.sms_sent)} sub={`${num(usage?.sms_sent_24h)} in 24h`} />
      </div>

      {/* DB footprint breakdown */}
      {usage?.db_footprint?.by_table && (
        <Panel title="Database footprint (rows by table)">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(usage.db_footprint.by_table).map(([t, n]) => (
              <div key={t} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                <p className="text-[11px] text-gray-400 truncate">{t}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{num(n)}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Feature controls */}
      <Panel title="Feature controls">
        {!features ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="space-y-4">
            <Toggle
              label="SMS sending"
              desc="Hard kill-switch — when off, no SMS leaves DRAIS for this school."
              on={features.sms_enabled}
              disabled={busy === 'feature'}
              onChange={(v) => setFeature({ sms_enabled: v })}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Modules</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(features.modules || {}).map(([code, on]) => (
                  <Toggle key={code} label={code} compact on={on} disabled={busy === 'feature'}
                    onChange={(v) => setFeature({ modules: { [code]: v } })} />
                ))}
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Staff directory */}
      <Panel title={`Staff directory${staff?.count != null ? ` (${staff.count})` : ''}`}>
        {!staff ? <p className="text-sm text-gray-400">Loading…</p> : (staff.staff || []).length === 0 ? (
          <p className="text-sm text-gray-400">No staff on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr><th className="py-1 pr-4">Name</th><th className="py-1 pr-4">Role</th><th className="py-1 pr-4">Department</th><th className="py-1">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {staff.staff.map((m, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{m.name}</td>
                    <td className="py-1.5 pr-4 text-gray-500">{m.role || '—'}</td>
                    <td className="py-1.5 pr-4 text-gray-500">{m.department || '—'}</td>
                    <td className="py-1.5 text-gray-500">{m.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-xl font-bold capitalize ${tone || 'text-gray-900 dark:text-white'}`}>{value}</p>
          {sub ? <p className="text-[11px] text-gray-400">{sub}</p> : null}
        </div>
        {Icon ? <Icon className="text-gray-300 dark:text-gray-600" size={22} /> : null}
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ label, desc, on, onChange, disabled, compact }) {
  return (
    <button onClick={() => onChange(!on)} disabled={disabled}
      className={`flex items-center justify-between gap-3 w-full rounded-lg border px-3 py-2 text-left disabled:opacity-50 ${on ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
      <span>
        <span className={`text-sm font-medium capitalize ${compact ? '' : 'text-gray-800 dark:text-gray-100'}`}>{label.replace(/_/g, ' ')}</span>
        {desc ? <span className="block text-[11px] text-gray-400">{desc}</span> : null}
      </span>
      {on ? <CheckCircle className="text-green-600 flex-shrink-0" size={18} /> : <XCircle className="text-gray-400 flex-shrink-0" size={18} />}
    </button>
  );
}
