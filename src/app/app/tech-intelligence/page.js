'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bug, Plus, AlertTriangle, CheckCircle, Clock, Search, X, ChevronDown, Filter, Code2, Zap } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
const STATUS_COLORS = {
  open: 'bg-red-100 text-red-700', in_progress: 'bg-purple-100 text-purple-700',
  resolved: 'bg-emerald-100 text-emerald-700', closed: 'bg-gray-100 text-gray-700', wont_fix: 'bg-gray-100 text-gray-700',
};

export default function TechIntelligencePage() {
  const [tab, setTab] = useState('bugs');
  const [bugs, setBugs] = useState([]);
  const [features, setFeatures] = useState([]);
  const [techStack, setTechStack] = useState([]);
  const [systems, setSystems] = useState([]);
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [systemFilter, setSystemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ system_id: '', title: '', description: '', severity: 'medium', module_affected: '', assigned_developer: '' });
  const [featureForm, setFeatureForm] = useState({ system_id: '', feature_title: '', description: '', priority: 'medium', assigned_developer: '' });
  const [showFeatureForm, setShowFeatureForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/bug-reports').then(r => r.json ? r.json() : r),
      fetchWithAuth('/api/feature-requests').then(r => r.json ? r.json() : r),
      fetchWithAuth('/api/tech-stack').then(r => r.json ? r.json() : r),
      fetchWithAuth('/api/systems').then(r => r.json ? r.json() : r),
      fetchWithAuth('/api/users').then(r => r.json ? r.json() : r).catch(() => ({ data: [] })),
    ]).then(([bugsRes, featRes, stackRes, sysRes, usersRes]) => {
      if (bugsRes.success) { setBugs(bugsRes.data); setMetrics(bugsRes.metrics || {}); }
      if (featRes.success) setFeatures(featRes.data);
      if (stackRes.success) setTechStack(stackRes.data);
      if (sysRes.success) setSystems(sysRes.data || []);
      setUsers(usersRes.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const submitBug = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/bug-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = res.json ? await res.json() : res;
      if (json.success) {
        setBugs(prev => [json.data, ...prev]);
        setShowForm(false);
        setForm({ system_id: '', title: '', description: '', severity: 'medium', module_affected: '', assigned_developer: '' });
      }
    } catch (err) { console.error(err); }
  };

  const submitFeature = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/feature-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(featureForm) });
      const json = res.json ? await res.json() : res;
      if (json.success) {
        setFeatures(prev => [json.data, ...prev]);
        setShowFeatureForm(false);
        setFeatureForm({ system_id: '', feature_title: '', description: '', priority: 'medium', assigned_developer: '' });
      }
    } catch (err) { console.error(err); }
  };

  const updateBugStatus = async (id, status) => {
    try {
      const res = await fetchWithAuth('/api/bug-reports', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      const json = res.json ? await res.json() : res;
      if (json.success) setBugs(prev => prev.map(b => b.id === id ? json.data : b));
    } catch {}
  };

  const updateFeatureStatus = async (id, status) => {
    try {
      const res = await fetchWithAuth('/api/feature-requests', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      const json = res.json ? await res.json() : res;
      if (json.success) setFeatures(prev => prev.map(f => f.id === id ? json.data : f));
    } catch {}
  };

  const filteredBugs = bugs.filter(b => {
    if (systemFilter && b.system_id !== systemFilter) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Technical Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">System engineering knowledge, bug tracking, and feature management</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Open Bugs</div>
          <div className="text-2xl font-bold text-red-600">{metrics.open_count || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold text-purple-600">{metrics.in_progress_count || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Resolved</div>
          <div className="text-2xl font-bold text-emerald-600">{metrics.resolved_count || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Critical Open</div>
          <div className="text-2xl font-bold text-red-700">{metrics.critical_open || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Avg Resolution</div>
          <div className="text-2xl font-bold text-blue-600">{metrics.avg_resolution_hours ? `${Math.round(metrics.avg_resolution_hours)}h` : 'N/A'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { id: 'bugs', label: 'Bug Reports', icon: Bug },
          { id: 'features', label: 'Feature Requests', icon: Zap },
          { id: 'stack', label: 'Tech Stack', icon: Code2 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Bug Reports Tab */}
      {tab === 'bugs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-background">
              <option value="">All Systems</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-background">
              <option value="">All Statuses</option>
              {['open', 'in_progress', 'resolved', 'closed'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <button onClick={() => setShowForm(true)} className="ml-auto flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Report Bug
            </button>
          </div>

          {showForm && (
            <form onSubmit={submitBug} className="bg-card rounded-xl border p-5 space-y-3">
              <div className="flex justify-between items-center"><h3 className="font-semibold">Report Bug</h3><button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">System *</label><select value={form.system_id} onChange={e => setForm(f => ({ ...f, system_id: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background"><option value="">Select...</option>{systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="text-xs text-muted-foreground">Severity</label><select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background">{['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Module Affected</label><input value={form.module_affected} onChange={e => setForm(f => ({ ...f, module_affected: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Assign To</label><select value={form.assigned_developer} onChange={e => setForm(f => ({ ...f, assigned_developer: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background"><option value="">Unassigned</option>{users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></div>
              </div>
              <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Submit Bug Report</button>
            </form>
          )}

          <div className="bg-card rounded-xl border divide-y">
            {filteredBugs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground"><Bug className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No bug reports found</p></div>
            ) : filteredBugs.map(bug => (
              <div key={bug.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[bug.severity]}`}>{bug.severity}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bug.status]}`}>{bug.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-muted-foreground">{bug.system_name}</span>
                    </div>
                    <h3 className="font-medium text-foreground mt-1">{bug.title}</h3>
                    {bug.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{bug.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {bug.module_affected && <span>Module: {bug.module_affected}</span>}
                      {bug.assignee_name && <span>→ {bug.assignee_name}</span>}
                      <span>{new Date(bug.created_at).toLocaleDateString()}</span>
                      {bug.time_to_resolve && <span className="text-emerald-600">Resolved in {bug.time_to_resolve}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {bug.status === 'open' && <button onClick={() => updateBugStatus(bug.id, 'in_progress')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Start</button>}
                    {bug.status === 'in_progress' && <button onClick={() => updateBugStatus(bug.id, 'resolved')} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">Resolve</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Requests Tab */}
      {tab === 'features' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowFeatureForm(true)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Request Feature
            </button>
          </div>

          {showFeatureForm && (
            <form onSubmit={submitFeature} className="bg-card rounded-xl border p-5 space-y-3">
              <div className="flex justify-between items-center"><h3 className="font-semibold">Request Feature</h3><button type="button" onClick={() => setShowFeatureForm(false)}><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">System *</label><select value={featureForm.system_id} onChange={e => setFeatureForm(f => ({ ...f, system_id: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background"><option value="">Select...</option>{systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="text-xs text-muted-foreground">Priority</label><select value={featureForm.priority} onChange={e => setFeatureForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background">{['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Feature Title *</label><input value={featureForm.feature_title} onChange={e => setFeatureForm(f => ({ ...f, feature_title: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Description</label><textarea value={featureForm.description} onChange={e => setFeatureForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Submit Feature Request</button>
            </form>
          )}

          <div className="bg-card rounded-xl border divide-y">
            {features.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground"><Zap className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No feature requests yet</p></div>
            ) : features.map(f => (
              <div key={f.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[f.priority]}`}>{f.priority}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] || 'bg-gray-100 text-gray-700'}`}>{f.status}</span>
                      <span className="text-xs text-muted-foreground">{f.system_name}</span>
                    </div>
                    <h3 className="font-medium text-foreground mt-1">{f.feature_title}</h3>
                    {f.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{f.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {f.status === 'proposed' && <button onClick={() => updateFeatureStatus(f.id, 'approved')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Approve</button>}
                    {f.status === 'approved' && <button onClick={() => updateFeatureStatus(f.id, 'in_progress')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">Start</button>}
                    {f.status === 'in_progress' && <button onClick={() => updateFeatureStatus(f.id, 'completed')} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded">Complete</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech Stack Tab */}
      {tab === 'stack' && (
        <div className="space-y-4">
          {systems.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">
              <Code2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No systems configured yet. Add systems first.</p>
            </div>
          ) : (
            systems.map(sys => {
              const entries = techStack.filter(t => t.system_id === sys.id);
              return (
                <div key={sys.id} className="bg-card rounded-xl border p-5">
                  <h3 className="font-semibold text-foreground mb-3">{sys.name}</h3>
                  {sys.description && <p className="text-sm text-muted-foreground mb-3">{sys.description}</p>}
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No tech stack entries</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {entries.map(e => (
                        <span key={e.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
                          <Code2 className="w-3.5 h-3.5" /> {e.language_or_framework} {e.version && <span className="text-xs opacity-70">v{e.version}</span>}
                          {e.role_in_system && <span className="text-xs opacity-70">({e.role_in_system})</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
