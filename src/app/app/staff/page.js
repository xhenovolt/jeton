'use client';

import { useEffect, useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-muted text-muted-foreground',
  contractor: 'bg-blue-100 text-blue-700',
};

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', status: 'active', joined_at: '', notes: '' });

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetchWithAuth('/api/staff');
      const json = await res.json();
      if (json.success) setStaff(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.joined_at) delete body.joined_at;
      if (!body.notes) delete body.notes;
      const res = await fetchWithAuth('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setStaff(prev => [json.data, ...prev]);
        setForm({ name: '', role: '', status: 'active', joined_at: '', notes: '' });
        setShowForm(false);
      }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      const member = staff.find(s => s.id === id);
      await fetchWithAuth('/api/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, role: member?.role, notes: member?.notes }) });
      setStaff(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch (err) { console.error(err); }
  };

  const remove = async (id) => {
    if (!confirm('Remove this staff member?')) return;
    try {
      await fetchWithAuth(`/api/staff?id=${id}`, { method: 'DELETE' });
      setStaff(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error(err); }
  };

  const active = staff.filter(s => s.status === 'active').length;
  const contractors = staff.filter(s => s.status === 'contractor').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {staff.length} total · {active} active · {contractors} contractors
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Add Staff Member</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name *" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
            <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Role (e.g. Developer)" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm [&>option]:bg-background">
              <option value="active">Active</option>
              <option value="contractor">Contractor</option>
              <option value="inactive">Inactive</option>
            </select>
            <input type="date" value={form.joined_at} onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes (optional)" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No staff members yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {staff.map(s => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status] || 'bg-muted text-muted-foreground'}`}>{s.status}</span>
                </div>
                {s.role && <p className="text-sm text-muted-foreground">{s.role}</p>}
                {s.joined_at && <p className="text-xs text-muted-foreground mt-0.5">Joined {new Date(s.joined_at).toLocaleDateString()}</p>}
                {s.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} className="text-xs px-2 py-1 border border-border rounded-lg bg-background text-foreground [&>option]:bg-background">
                  <option value="active">Active</option>
                  <option value="contractor">Contractor</option>
                  <option value="inactive">Inactive</option>
                </select>
                <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
