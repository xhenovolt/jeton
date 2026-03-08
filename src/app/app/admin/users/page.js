'use client';

import { useEffect, useState } from 'react';
import { Users, Shield, ShieldCheck, Edit, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

const ROLE_COLORS = { superadmin: 'bg-red-100 text-red-700', admin: 'bg-purple-100 text-purple-700', user: 'bg-blue-100 text-blue-700' };

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', status: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try { const res = await fetchWithAuth('/api/admin/users'); const j = await res.json(); if (j.success) setUsers(j.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const startEdit = (u) => { setEditUser(u); setEditForm({ role: u.role, status: u.status || 'active' }); };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/users/${editUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      if ((await res.json()).success) { setEditUser(null); fetchUsers(); }
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} registered users</p>
      </div>

      {editUser && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Editing: {editUser.name || editUser.email}</h2>
            <button onClick={() => setEditUser(null)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                {['user', 'admin', 'superadmin'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                {['active', 'inactive', 'suspended'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button onClick={saveEdit} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  {u.role === 'superadmin' ? <ShieldCheck className="w-5 h-5 text-red-600" /> : u.role === 'admin' ? <Shield className="w-5 h-5 text-purple-600" /> : <Users className="w-5 h-5 text-gray-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{u.name || 'No name'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                    {u.status && u.status !== 'active' && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{u.status}</span>}
                  </div>
                  <div className="text-xs text-gray-400">{u.email} &middot; joined {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <button onClick={() => startEdit(u)} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-400" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
