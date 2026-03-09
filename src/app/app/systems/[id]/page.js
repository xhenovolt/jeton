'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowLeft, AlertCircle, Zap, Briefcase, Key, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ISSUE_STATUS_STYLES = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-orange-100 text-orange-700',
  fixed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
};

const CHANGE_STATUS_STYLES = {
  planned: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const DEAL_STATUS_STYLES = {
  draft: 'bg-muted text-foreground',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  negotiation: 'bg-yellow-100 text-yellow-700',
  payment_pending: 'bg-orange-100 text-orange-700',
};

function formatUGX(n) {
  return 'UGX ' + Math.round(parseFloat(n || 0)).toLocaleString();
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition ${active ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
    >
      {label}
    </button>
  );
}

export default function SystemDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issueForm, setIssueForm] = useState({ title: '', description: '', status: 'open' });
  const [changeForm, setChangeForm] = useState({ title: '', description: '', status: 'planned' });
  const [editForm, setEditForm] = useState({});

  useEffect(() => { if (id) fetchSystem(); }, [id]);

  const fetchSystem = async () => {
    try {
      const res = await fetchWithAuth(`/api/systems/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setEditForm({ name: json.data.name, description: json.data.description || '', version: json.data.version || '', status: json.data.status });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submitIssue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => ({ ...prev, issues: [json.data, ...prev.issues] }));
        setIssueForm({ title: '', description: '', status: 'open' });
        setShowIssueForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const submitChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeForm),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => ({ ...prev, changes: [json.data, ...prev.changes] }));
        setChangeForm({ title: '', description: '', status: 'planned' });
        setShowChangeForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const updateIssueStatus = async (issueId, newStatus) => {
    try {
      await fetchWithAuth(`/api/systems/${id}/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, status: newStatus }),
      });
      setData(prev => ({
        ...prev,
        issues: prev.issues.map(i =>
          i.id === issueId
            ? { ...i, status: newStatus, resolved_at: (newStatus === 'fixed' || newStatus === 'closed') ? new Date().toISOString() : null }
            : i
        ),
      }));
    } catch (err) { console.error(err); }
  };

  const updateChangeStatus = async (changeId, newStatus) => {
    try {
      await fetchWithAuth(`/api/systems/${id}/changes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: changeId, status: newStatus }),
      });
      setData(prev => ({
        ...prev,
        changes: prev.changes.map(c =>
          c.id === changeId ? { ...c, status: newStatus } : c
        ),
      }));
    } catch (err) { console.error(err); }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/systems/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => ({ ...prev, ...json.data }));
        setShowEditForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!data) return <div className="p-6 text-center text-muted-foreground">System not found</div>;

  const deals = data.deals || [];
  const totalPaid = deals.reduce((s, d) => s + parseFloat(d.paid_amount || 0), 0);
  const totalRemaining = deals.reduce((s, d) => s + parseFloat(d.remaining_amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <Link href="/app/systems" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition w-fit">
        <ArrowLeft className="w-4 h-4" /> All Systems
      </Link>

      {/* System Header */}
      <div className="bg-card rounded-xl border border-border p-6">
        {showEditForm ? (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="System name" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              <input value={editForm.version} onChange={e => setEditForm(f => ({ ...f, version: e.target.value }))} placeholder="Version" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            <div className="flex gap-2">
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                <option value="active">Active</option>
                <option value="development">In Development</option>
                <option value="deprecated">Deprecated</option>
                <option value="archived">Archived</option>
              </select>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => setShowEditForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
                {data.version && <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">v{data.version}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{data.status}</span>
              </div>
              {data.description && <p className="text-muted-foreground">{data.description}</p>}
            </div>
            <button onClick={() => setShowEditForm(true)} className="text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition">Edit</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Deals</p>
            <p className="text-xl font-bold text-foreground">{deals.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</p>
            <p className="text-xl font-bold text-foreground">{formatUGX(data.total_revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Collected</p>
            <p className="text-xl font-bold text-emerald-600">{formatUGX(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <p className={`text-xl font-bold ${totalRemaining > 0 ? 'text-orange-600' : 'text-foreground'}`}>{formatUGX(totalRemaining)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabButton label={`Deals (${deals.length})`} active={tab === 'overview'} onClick={() => setTab('overview')} />
        <TabButton label={`Licenses (${(data.licenses || []).length})`} active={tab === 'licenses'} onClick={() => setTab('licenses')} />
        <TabButton label={`Issues (${(data.issues || []).length})`} active={tab === 'issues'} onClick={() => setTab('issues')} />
        <TabButton label={`Changes (${(data.changes || []).length})`} active={tab === 'changes'} onClick={() => setTab('changes')} />
      </div>

      {/* ── DEALS TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Sales History</h2>
            <Link href={`/app/deals/new?system_id=${id}`} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-3.5 h-3.5" /> Record Deal
            </Link>
          </div>
          {deals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No deals recorded for this system yet</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {deals.map(d => {
                const paid = parseFloat(d.paid_amount || 0);
                const total = parseFloat(d.total_amount || 0);
                const pct = total > 0 ? (paid / total) * 100 : 0;
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{d.client_label}</p>
                        <p className="text-sm text-muted-foreground">{d.title}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEAL_STATUS_STYLES[d.status] || 'bg-muted text-muted-foreground'}`}>{d.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{formatUGX(d.total_amount)}</span></span>
                      <span className="text-muted-foreground">Paid: <span className="text-emerald-600 font-medium">{formatUGX(d.paid_amount)}</span> · Remaining: <span className={`font-medium ${parseFloat(d.remaining_amount) > 0 ? 'text-orange-600' : 'text-foreground'}`}>{formatUGX(d.remaining_amount)}</span></span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LICENSES TAB ── */}
      {tab === 'licenses' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Licenses</h2>
          </div>
          {(data.licenses || []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No licenses issued for this system</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {data.licenses.map(l => (
                <div key={l.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{l.client_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{l.license_type} license · {l.start_date ? new Date(l.start_date).toLocaleDateString() : 'No start date'}</p>
                    {l.notes && <p className="text-xs text-muted-foreground mt-0.5">{l.notes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ISSUES TAB ── */}
      {tab === 'issues' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Issues</h2>
            <button onClick={() => setShowIssueForm(!showIssueForm)} className="flex items-center gap-1 text-sm bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
              <Plus className="w-3.5 h-3.5" /> Report Issue
            </button>
          </div>
          {showIssueForm && (
            <form onSubmit={submitIssue} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <input required value={issueForm.title} onChange={e => setIssueForm(f => ({ ...f, title: e.target.value }))} placeholder="Issue title *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <textarea value={issueForm.description} onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the issue..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <div className="flex gap-2">
                <select value={issueForm.status} onChange={e => setIssueForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="fixed">Fixed</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700">Save</button>
                <button type="button" onClick={() => setShowIssueForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}
          {(data.issues || []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No issues reported</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {data.issues.map(issue => (
                <div key={issue.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{issue.title}</p>
                    {issue.description && <p className="text-sm text-muted-foreground mt-0.5">{issue.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported {new Date(issue.reported_at).toLocaleDateString()}
                      {issue.resolved_at && ` · Resolved ${new Date(issue.resolved_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <select
                    value={issue.status}
                    onChange={e => updateIssueStatus(issue.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${ISSUE_STATUS_STYLES[issue.status] || 'bg-muted text-muted-foreground'} [&>option]:bg-background`}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="fixed">Fixed</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CHANGES TAB ── */}
      {tab === 'changes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Improvements & Changes</h2>
            <button onClick={() => setShowChangeForm(!showChangeForm)} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
              <Plus className="w-3.5 h-3.5" /> Add Change
            </button>
          </div>
          {showChangeForm && (
            <form onSubmit={submitChange} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <input required value={changeForm.title} onChange={e => setChangeForm(f => ({ ...f, title: e.target.value }))} placeholder="Change title *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <textarea value={changeForm.description} onChange={e => setChangeForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the improvement..." className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
              <div className="flex gap-2">
                <select value={changeForm.status} onChange={e => setChangeForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700">Save</button>
                <button type="button" onClick={() => setShowChangeForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              </div>
            </form>
          )}
          {(data.changes || []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No changes recorded</div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {data.changes.map(change => (
                <div key={change.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{change.title}</p>
                    {change.description && <p className="text-sm text-muted-foreground mt-0.5">{change.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {new Date(change.created_at).toLocaleDateString()}
                      {change.completed_at && ` · Completed ${new Date(change.completed_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <select
                    value={change.status}
                    onChange={e => updateChangeStatus(change.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${CHANGE_STATUS_STYLES[change.status] || 'bg-muted text-muted-foreground'} [&>option]:bg-background`}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
