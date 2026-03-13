'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Users, Trash2, X, ChevronRight, Building2, Pencil, Search, Shield } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-muted text-muted-foreground',
  contractor: 'bg-blue-100 text-blue-700',
  probation: 'bg-yellow-100 text-yellow-700',
};

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [roleResults, setRoleResults] = useState([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState('list'); // list | hierarchy
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: '', department: '', department_id: '', role_id: '', position: '',
    salary: '', salary_currency: 'UGX', salary_account_id: '', manager_id: '',
    hire_date: '', status: 'active', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/departments');
      const j = await res.json();
      if (j.success) setDepartments(j.data || []);
    } catch {}
  }, []);

  const searchRoles = useCallback(async (q) => {
    if (!q || q.length < 1) { setRoleResults([]); return; }
    try {
      const params = new URLSearchParams({ q, limit: '10' });
      if (form.department_id) params.set('department_id', form.department_id);
      const res = await fetchWithAuth(`/api/roles/search?${params}`);
      const j = await res.json();
      if (j.success) setRoleResults(j.data || []);
    } catch {}
  }, [form.department_id]);

  useEffect(() => {
    fetchStaff();
    fetchDepartments();
    fetchWithAuth('/api/accounts').then(r => r.json()).then(j => { if (j.success) setAccounts(j.data || []); }).catch(() => {});
  }, [fetchDepartments]);

  const fetchStaff = async () => {
    try { const res = await fetchWithAuth('/api/staff'); const j = await res.json(); if (j.success) setStaff(j.data || []); } catch {} finally { setLoading(false); }
  };

  const resetForm = () => { setForm({ name: '', email: '', phone: '', role: '', department: '', department_id: '', role_id: '', position: '', salary: '', salary_currency: 'UGX', salary_account_id: '', manager_id: '', hire_date: '', status: 'active', notes: '' }); setRoleSearch(''); setRoleResults([]); };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form };
      if (body.salary) body.salary = parseFloat(body.salary);
      else delete body.salary;
      Object.keys(body).forEach(k => { if (body[k] === '') delete body[k]; });
      if (editId) body.id = editId;

      const url = editId ? '/api/staff' : '/api/staff';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if ((await res.json()).success) { setShowForm(false); setEditId(null); resetForm(); fetchStaff(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const startEdit = (s) => {
    setForm({
      name: s.name || '', email: s.email || '', phone: s.phone || '', role: s.role || '',
      department: s.department || s.dept_name || '', department_id: s.department_id || '', role_id: s.role_id || '',
      position: s.position || '', salary: s.salary?.toString() || '',
      salary_currency: s.salary_currency || 'UGX', salary_account_id: s.salary_account_id || '',
      manager_id: s.manager_id || '', hire_date: s.hire_date?.split('T')[0] || '', status: s.status || 'active', notes: s.notes || '',
    });
    setRoleSearch(s.role_name || s.role || '');
    setEditId(s.id); setShowForm(true);
  };

  const deleteStaff = async (id) => {
    if (!confirm('Delete this team member?')) return;
    try { await fetchWithAuth(`/api/staff?id=${id}`, { method: 'DELETE' }); fetchStaff(); } catch {}
  };

  const deptNames = departments.map(d => d.name);
  const filtered = deptFilter ? staff.filter(s => (s.department === deptFilter || s.dept_name === deptFilter)) : staff;

  // Build hierarchy tree
  const buildTree = () => {
    const map = {};
    staff.forEach(s => { map[s.id] = { ...s, children: [] }; });
    const roots = [];
    staff.forEach(s => {
      if (s.manager_id && map[s.manager_id]) map[s.manager_id].children.push(map[s.id]);
      else roots.push(map[s.id]);
    });
    return roots;
  };

  const TreeNode = ({ node, depth = 0 }) => (
    <div style={{ marginLeft: depth * 24 }} className="py-2">
      <div className="flex items-center gap-2 text-sm">
        {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="font-medium text-foreground">{node.name}</span>
        {node.position && <span className="text-muted-foreground">— {node.position}</span>}
        {node.department && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{node.department}</span>}
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_STYLES[node.status] || 'bg-muted text-foreground'}`}>{node.status}</span>
      </div>
      {node.children.map(c => <TreeNode key={c.id} node={c} depth={depth + 1} />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">{staff.length} members · {staff.filter(s => s.status === 'active').length} active</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); resetForm(); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setTab('list')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'}`}>
          <Users className="w-4 h-4 inline mr-1" />List
        </button>
        <button onClick={() => setTab('hierarchy')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'hierarchy' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'}`}>
          <Building2 className="w-4 h-4 inline mr-1" />Hierarchy
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit' : 'Add'} Team Member</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Department</label>
              <select value={form.department_id} onChange={e => {
                const dept = departments.find(d => d.id === e.target.value);
                setForm(f => ({ ...f, department_id: e.target.value, department: dept?.name || '' }));
              }} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">Select department...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm text-muted-foreground mb-1">Role</label>
              <div className="relative">
                <input
                  value={roleSearch}
                  onChange={e => { setRoleSearch(e.target.value); searchRoles(e.target.value); setShowRoleDropdown(true); }}
                  onFocus={() => { if (roleSearch) { searchRoles(roleSearch); setShowRoleDropdown(true); } }}
                  placeholder="Search roles..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground pr-8"
                />
                <Search className="w-4 h-4 absolute right-2.5 top-2.5 text-muted-foreground" />
              </div>
              {showRoleDropdown && roleResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {roleResults.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, role_id: r.id, role: r.name }));
                        setRoleSearch(r.name);
                        setShowRoleDropdown(false);
                        if (r.department_id && !form.department_id) {
                          const dept = departments.find(d => d.id === r.department_id);
                          if (dept) setForm(f => ({ ...f, department_id: dept.id, department: dept.name }));
                        }
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between"
                    >
                      <span className="text-foreground">{r.name}</span>
                      {r.department_name && <span className="text-xs text-muted-foreground">{r.department_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Position Title</label>
              <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Software Engineer" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Reports To</label>
              <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">No manager (top-level)</option>
                {staff.filter(s => s.id !== editId).map(s => <option key={s.id} value={s.id}>{s.name}{s.position ? ` — ${s.position}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Salary</label>
              <div className="flex gap-2">
                <select value={form.salary_currency} onChange={e => setForm(f => ({ ...f, salary_currency: e.target.value }))} className="w-20 px-2 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
                  <option value="UGX">UGX</option><option value="USD">USD</option>
                </select>
                <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="Monthly" className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Salary Account</label>
              <select value={form.salary_account_id} onChange={e => setForm(f => ({ ...f, salary_account_id: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                <option value="">None</option>
                {accounts.filter(a => a.type === 'salary').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Hire Date</label>
              <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {['active','inactive','contractor','probation'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Add Member'}</button>
        </form>
      )}

      {/* Department filter */}
      {tab === 'list' && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setDeptFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!deptFilter ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>All</button>
          {departments.map(d => {
            const count = staff.filter(s => s.department === d.name || s.dept_name === d.name).length;
            if (count === 0) return null;
            return <button key={d.id} onClick={() => setDeptFilter(d.name)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${deptFilter === d.name ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>{d.name} ({count})</button>;
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : tab === 'hierarchy' ? (
        <div className="bg-card rounded-xl border p-5">
          <h2 className="font-semibold text-foreground mb-4">Organization Hierarchy</h2>
          {staff.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">No team members</p> : (
            buildTree().map(node => <TreeNode key={node.id} node={node} />)
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No team members found.</div>
      ) : (
        <div className="bg-card rounded-xl border divide-y divide-border">
          {filtered.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{s.name?.charAt(0)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status] || 'bg-muted text-foreground'}`}>{s.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.position || s.role_name || s.role || 'No role'}
                    {(s.dept_name || s.department) && ` · ${s.dept_name || s.department}`}
                    {s.email && ` · ${s.email}`}
                    {s.manager_name && ` · Reports to: ${s.manager_name}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.salary && <span className="text-sm font-medium text-foreground">{s.salary_currency || 'UGX'} {Math.round(parseFloat(s.salary)).toLocaleString()}/mo</span>}
                <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-muted"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                <button onClick={() => deleteStaff(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
